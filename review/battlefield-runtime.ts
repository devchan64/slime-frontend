import {collectMapResourceKeys} from '../packages/field-renderer/map-resource-plan';
import {createGame} from '../src/game/createGame';
import {BattlefieldReviewGame} from './battlefield-game';
import type {State} from '../src/client/types';
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
  const currentHeadingElement=document.createElement('h1');currentHeadingElement.textContent='전투필드 · 지형 검수';
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
  currentGalleryElement.className='';
  const currentShownFixtures=currentSingleField?BATTLE_REVIEW_FIXTURES.filter(currentFixtureRecord=>currentFixtureRecord.battle!.field!.id===currentSelectedField):BATTLE_REVIEW_FIXTURES;
  const currentRenderEpoch=currentSelectionEpoch;
  const currentReadyFields=new Set<string>();
  updateReviewStatus(`전장 0/${currentShownFixtures.length} 준비 중`);
  for(const currentFixtureRecord of currentShownFixtures){
   const currentBattleRecord=currentFixtureRecord.battle!;
   const currentFieldRecord=currentBattleRecord.field!;
   const currentSectionElement=document.createElement('section');currentSectionElement.className='field';
   const currentTitleElement=document.createElement('h2');currentTitleElement.className='world-title';currentTitleElement.textContent=(currentFieldRecord.selection==='random'?'랜덤 · ':'이벤트 고정 · ')+currentFieldRecord.name;
   const currentCanvasElement=document.createElement('div');currentCanvasElement.className='canvas canvas-wrap field-preview-canvas';
   const currentStageElement=document.createElement('div');currentStageElement.className='map-stage';
   currentStageElement.append(currentCanvasElement);currentSectionElement.append(currentTitleElement,currentStageElement);
   currentGalleryElement.append(currentSectionElement);
   const currentSelectionActive=()=>!currentReviewDisposed&&currentSelectionEpoch===currentRenderEpoch;
   const reportReviewFailure=(currentFailureMessage:string)=>{
    if(!currentSelectionActive())return;
    updateReviewStatus(`전장 로드 실패: ${currentFailureMessage}`);
    releaseReviewSelection();
   };
   const {game:currentGameInstance,scene:currentSceneInstance}=createGame(currentCanvasElement,()=>{},()=>{
    if(!currentSelectionActive())return;
    currentReadyFields.add(currentFieldRecord.id);updateReviewStatus(`전장 ${currentReadyFields.size}/${currentShownFixtures.length} 렌더링 완료 · 12×10 타일`);
   },currentFailureNotice=>reportReviewFailure(noticeText(currentFailureNotice,currentReviewOptions.locale,t)),BattlefieldReviewGame,collectMapResourceKeys(currentFieldRecord,'battle'),[...new Set(currentBattleRecord.units.map(currentUnitRecord=>currentUnitRecord.side==='enemy'?(currentUnitRecord.monsterTypeId??currentUnitRecord.appearance??'slime'):'human'))]);
   const currentCameraMenu=document.createElement('nav');currentCameraMenu.className='map-camera-controls';currentCameraMenu.setAttribute('aria-label','맵 화면 조정');
   const currentCameraActions:[string,string,()=>void][]=[['맵 축소','−',()=>currentSceneInstance.adjustZoom(-BATTLE_REVIEW_ZOOM_STEP)],['맵 확대','＋',()=>currentSceneInstance.adjustZoom(BATTLE_REVIEW_ZOOM_STEP)],['시점 복귀','복귀',()=>currentSceneInstance.focus()]];
   for(const [currentButtonLabel,currentButtonText,currentCameraAction] of currentCameraActions){const currentActionButton=document.createElement('button');currentActionButton.textContent=currentButtonText;currentActionButton.setAttribute('aria-label',currentButtonLabel);currentActionButton.onclick=currentCameraAction;currentCameraMenu.append(currentActionButton);}
   currentStageElement.append(currentCameraMenu);
   const currentPreparationStarted=performance.now();
   const currentPreparationTimer=setInterval(()=>{
    if(!currentSelectionActive())return;
    if(performance.now()-currentPreparationStarted>BATTLE_REVIEW_PREPARE_MS){reportReviewFailure('지형·장면 준비가 60초 안에 완료되지 않았습니다.');return;}
    if(!currentSceneInstance.sys.isActive()||!currentSceneInstance.textures.exists('meadow-terrain'))return;
    clearInterval(currentPreparationTimer);
    try{currentSceneInstance.setState(currentFixtureRecord);}catch(currentPreparationError){reportReviewFailure(currentPreparationError instanceof Error?currentPreparationError.message:String(currentPreparationError));}
   },BATTLE_REVIEW_POLL_MS);
   currentReleaseCallbacks.push(()=>{clearInterval(currentPreparationTimer);currentGameInstance.destroy(true);});
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
