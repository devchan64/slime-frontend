import {h,render} from 'preact';
import {BattlePanel} from '../src/ui/BattlePanel';
import {createGame} from '../src/game/createGame';
import {BattlefieldReviewGame} from './battlefield-game';
import type {Position,State} from '../src/client/types';
import {noticeText} from '../src/client/notice';
import {t,type Locale} from '../src/i18n';
import currentBattleFixtures from '../src/dev/battlefield-fixtures.json';

const BATTLE_REVIEW_POLL_MS=50;
const BATTLE_REVIEW_ZOOM_STEP=0.15;
const BATTLE_REVIEW_PREPARE_MS=60000;
const BATTLE_REVIEW_FIXTURES=currentBattleFixtures as unknown as State[];
const BATTLE_REVIEW_CHOICES:[string,string][]=[['전체 6종 비교 (랜덤 5 + 이벤트 1)','all'],...BATTLE_REVIEW_FIXTURES.map((currentFixtureRecord):[string,string]=>{
 const currentFieldRecord=currentFixtureRecord.battle?.field;
 if(!currentFieldRecord||typeof currentFieldRecord.name!=='string'||!currentFieldRecord.name.trim()||typeof currentFieldRecord.id!=='string'||!currentFieldRecord.id.trim())throw new Error('검수 전장의 이름·ID가 없습니다.');
 return [currentFieldRecord.name,currentFieldRecord.id];
})];

export function mountBattlefieldReview(currentReviewRoot:HTMLElement,currentReviewOptions:{field:string;locale:Locale;overview:boolean;controls:boolean}){
 let currentSelectedField='all';
 let currentReviewStatus='화면 준비 중';
 let currentReviewDisposed=false;
 let currentSelectionEpoch=0;
 let currentReleaseCallbacks:(()=>void)[]=[];
 const currentGalleryElement=document.createElement('main');
 currentGalleryElement.id='gallery';
 const currentStatusElement=document.createElement('div');
 currentStatusElement.id='status';
 const currentFieldSelector=document.createElement('select');
 currentFieldSelector.setAttribute('aria-label','전장 선택');
 for(const [currentFieldLabel,currentFieldIdentifier] of BATTLE_REVIEW_CHOICES){
  const currentFieldOption=document.createElement('option');currentFieldOption.value=currentFieldIdentifier;currentFieldOption.textContent=currentFieldLabel;currentFieldSelector.append(currentFieldOption);
 }
 currentReviewRoot.classList.toggle('overview',currentReviewOptions.overview);
 if(currentReviewOptions.controls){
  const currentHeaderElement=document.createElement('header');
  const currentHeadingElement=document.createElement('h1');currentHeadingElement.textContent='이슬 초원 · 전술전장 디자인';
  currentHeaderElement.append(currentHeadingElement,currentFieldSelector,currentStatusElement);currentReviewRoot.append(currentHeaderElement);
 }
 currentReviewRoot.append(currentGalleryElement);
 function updateReviewStatus(currentStatusMessage:string){currentReviewStatus=currentStatusMessage;currentStatusElement.textContent=currentStatusMessage;}
 function releaseReviewSelection(){
  currentSelectionEpoch++;
  for(const currentReleaseCallback of currentReleaseCallbacks)currentReleaseCallback();
  currentReleaseCallbacks=[];
  currentGalleryElement.replaceChildren();
 }
 function selectReviewField(currentFieldIdentifier:string){
  if(currentReviewDisposed)throw new Error('해제된 전장 검수 화면입니다.');
  if(!BATTLE_REVIEW_CHOICES.some(currentChoiceRecord=>currentChoiceRecord[1]===currentFieldIdentifier))throw new Error('존재하지 않는 전장입니다.');
  releaseReviewSelection();
  currentSelectedField=currentFieldIdentifier;
  currentFieldSelector.value=currentFieldIdentifier;
  const currentSingleField=currentSelectedField!=='all';
  currentReviewRoot.classList.toggle('single',currentSingleField);
  currentReviewRoot.classList.toggle('world-shell',currentSingleField);
  currentReviewRoot.classList.toggle('battle-preview-shell',currentSingleField);
  currentGalleryElement.className=currentSingleField?'world-layout world-layout--immersive':'';
  const currentShownFixtures=currentSingleField?BATTLE_REVIEW_FIXTURES.filter(currentFixtureRecord=>currentFixtureRecord.battle!.field!.id===currentSelectedField):BATTLE_REVIEW_FIXTURES;
  const currentRenderEpoch=currentSelectionEpoch;
  const currentReadyFields=new Set<string>();
  updateReviewStatus(`전장 0/${currentShownFixtures.length} 준비 중`);
  for(const currentFixtureRecord of currentShownFixtures){
   const currentBattleRecord=currentFixtureRecord.battle!;
   const currentFieldRecord=currentBattleRecord.field!;
   const currentSectionElement=document.createElement('section');currentSectionElement.className='field world is-battle';
   const currentTitleElement=document.createElement('h2');currentTitleElement.className='world-title';currentTitleElement.textContent=(currentFieldRecord.selection==='random'?'랜덤 · ':'이벤트 고정 · ')+currentFieldRecord.name;
   const currentCanvasElement=document.createElement('div');currentCanvasElement.className='canvas canvas-wrap field-preview-canvas';
   const currentStageElement=document.createElement('div');currentStageElement.className=currentSingleField?'map-stage card battle-map-card':'map-stage';
   const currentHudElement=document.createElement('div');currentHudElement.className='preview-hud';
   currentStageElement.append(currentCanvasElement);currentSectionElement.append(currentTitleElement,currentStageElement);
   if(currentSingleField)currentSectionElement.append(currentHudElement);
   currentGalleryElement.append(currentSectionElement);
   let currentCellSelection:Position|null=null;
   const currentSelectionActive=()=>!currentReviewDisposed&&currentSelectionEpoch===currentRenderEpoch;
   const drawReviewHud=()=>{
    if(!currentSelectionActive()||!currentSingleField)return;
    render(h(BattlePanel,{me:currentFixtureRecord.me,battle:currentBattleRecord,actor:currentFixtureRecord.me.id,selected:currentCellSelection,disabled:false,
     onMode:currentBattleMode=>currentSceneInstance.setBattleMode(currentBattleMode),
     select:currentSelectedCell=>{if(currentCellSelection?.column===currentSelectedCell?.column&&currentCellSelection?.row===currentSelectedCell?.row)return;currentCellSelection=currentSelectedCell;currentSceneInstance.selectCell(currentSelectedCell);queueMicrotask(drawReviewHud);},
     execute:currentActionType=>updateReviewStatus(`디자인 미리보기: ${currentActionType} 선택 · 실제 명령은 전송하지 않습니다.`)}),currentHudElement);
   };
   const reportReviewFailure=(currentFailureMessage:string)=>{
    if(!currentSelectionActive())return;
    updateReviewStatus(`전장 로드 실패: ${currentFailureMessage}`);
    releaseReviewSelection();
   };
   const {game:currentGameInstance,scene:currentSceneInstance}=createGame(currentCanvasElement,currentSelectedCell=>{currentCellSelection=currentSelectedCell;drawReviewHud();},()=>{
    if(!currentSelectionActive())return;
    currentReadyFields.add(currentFieldRecord.id);updateReviewStatus(`전장 ${currentReadyFields.size}/${currentShownFixtures.length} 렌더링 완료 · 12×10 타일 · 파란색은 이동 가능 범위`);
   },currentFailureNotice=>reportReviewFailure(noticeText(currentFailureNotice,currentReviewOptions.locale,t)),BattlefieldReviewGame);
   const currentCameraMenu=document.createElement('nav');currentCameraMenu.className='map-camera-controls';currentCameraMenu.setAttribute('aria-label','맵 화면 조정');
   const currentCameraActions:[string,string,()=>void][]=[['맵 축소','−',()=>currentSceneInstance.adjustZoom(-BATTLE_REVIEW_ZOOM_STEP)],['맵 확대','＋',()=>currentSceneInstance.adjustZoom(BATTLE_REVIEW_ZOOM_STEP)],['맵 왼쪽으로 90도 회전','↶',()=>currentSceneInstance.rotateMap(-1)],['맵 오른쪽으로 90도 회전','↷',()=>currentSceneInstance.rotateMap(1)],['시점 복귀','복귀',()=>currentSceneInstance.focus()]];
   for(const [currentButtonLabel,currentButtonText,currentCameraAction] of currentCameraActions){const currentActionButton=document.createElement('button');currentActionButton.textContent=currentButtonText;currentActionButton.setAttribute('aria-label',currentButtonLabel);currentActionButton.onclick=currentCameraAction;currentCameraMenu.append(currentActionButton);}
   currentStageElement.append(currentCameraMenu);
   const currentPreparationStarted=performance.now();
   const currentPreparationTimer=setInterval(()=>{
    if(!currentSelectionActive())return;
    if(performance.now()-currentPreparationStarted>BATTLE_REVIEW_PREPARE_MS){reportReviewFailure('지형·장면 준비가 60초 안에 완료되지 않았습니다.');return;}
    if(!currentSceneInstance.sys.isActive()||!currentSceneInstance.textures.exists('meadow-terrain'))return;
    clearInterval(currentPreparationTimer);
    try{currentSceneInstance.setState(currentFixtureRecord);drawReviewHud();}catch(currentPreparationError){reportReviewFailure(currentPreparationError instanceof Error?currentPreparationError.message:String(currentPreparationError));}
   },BATTLE_REVIEW_POLL_MS);
   currentReleaseCallbacks.push(()=>{clearInterval(currentPreparationTimer);render(null,currentHudElement);currentGameInstance.destroy(true);});
  }
 }
 currentFieldSelector.onchange=()=>selectReviewField(currentFieldSelector.value);
 try{selectReviewField(currentReviewOptions.field);}catch(currentMountError){releaseReviewSelection();throw currentMountError;}
 return {
  readState:()=>({choices:BATTLE_REVIEW_CHOICES.map(currentChoiceRecord=>[...currentChoiceRecord]),field:currentSelectedField,status:currentReviewStatus}),
  selectField:selectReviewField,
  dispose(){if(currentReviewDisposed)return;currentReviewDisposed=true;releaseReviewSelection();currentReviewRoot.replaceChildren();},
 };
}
