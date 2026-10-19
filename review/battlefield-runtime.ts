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
const BATTLE_CANVAS_ASPECT_RATIO='4 / 3';
const BATTLE_REVIEW_FIXTURES=currentBattleFixtures as unknown as State[];
const BATTLE_REVIEW_CHOICES:[string,string][]=BATTLE_REVIEW_FIXTURES.map((currentFixtureRecord):[string,string]=>{
 const currentFieldRecord=currentFixtureRecord.battle?.field;
 if(!currentFieldRecord||typeof currentFieldRecord.name!=='string'||!currentFieldRecord.name.trim()||typeof currentFieldRecord.id!=='string'||!currentFieldRecord.id.trim())throw new Error('검수 전장의 이름·ID가 없습니다.');
 return [currentFieldRecord.name,currentFieldRecord.id];
});
if(!BATTLE_REVIEW_CHOICES.length)throw new Error('등록된 검수 전장이 없습니다.');
export const BATTLE_REVIEW_DEFAULT_FIELD=BATTLE_REVIEW_CHOICES[0][1];

export function mountBattlefieldReview(currentReviewRoot:HTMLElement,currentReviewOptions:{field:string;locale:Locale;overview:boolean;controls:boolean}){
 let currentSelectedField=BATTLE_REVIEW_DEFAULT_FIELD;
 let currentReviewStatus='화면 준비 중';
 let currentReviewDisposed=false;
 let currentSelectionEpoch=0;
 let currentCameraAction:((currentActionName:string)=>void)|null=null;
 let currentCameraReady=false;
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
 if(currentReviewOptions.controls){
  const currentHeaderElement=document.createElement('header');
  const currentHeadingElement=document.createElement('h1');currentHeadingElement.textContent='전투필드 · 지형 검수';
  currentHeaderElement.append(currentHeadingElement,currentFieldSelector,currentStatusElement);currentReviewRoot.append(currentHeaderElement);
 }
 currentReviewRoot.append(currentGalleryElement);
 function updateReviewStatus(currentStatusMessage:string){currentReviewStatus=currentStatusMessage;currentStatusElement.textContent=currentStatusMessage;}
 function releaseReviewSelection(){
  currentSelectionEpoch++;
  currentCameraAction=null;currentCameraReady=false;
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
  const currentFixtureRecord=BATTLE_REVIEW_FIXTURES.find(currentFixtureRecord=>currentFixtureRecord.battle!.field.id===currentSelectedField)!;
  const currentRenderEpoch=currentSelectionEpoch;
  updateReviewStatus(`${currentFixtureRecord.battle!.field.name} 준비 중`);
   const currentBattleRecord=currentFixtureRecord.battle!;
   const currentFieldRecord=currentBattleRecord.field!;
   const currentSectionElement=document.createElement('section');
   const currentTitleElement=document.createElement('h2');currentTitleElement.textContent=(currentFieldRecord.selection==='random'?'랜덤 · ':'이벤트 고정 · ')+currentFieldRecord.name;
   const currentCanvasElement=document.createElement('div');currentCanvasElement.setAttribute('aria-label','전장 캔버스');
   // WebGL 표시 영역의 종횡비·클리핑만 지정한다. UI 테마는 Gradio가 담당한다.
   currentCanvasElement.style.aspectRatio=BATTLE_CANVAS_ASPECT_RATIO;
   currentCanvasElement.style.position='relative';
   currentCanvasElement.style.overflow='hidden';
   const currentStageElement=document.createElement('div');
   currentStageElement.append(currentCanvasElement);
   if(currentReviewOptions.controls)currentSectionElement.append(currentTitleElement);
   currentSectionElement.append(currentStageElement);
   currentGalleryElement.append(currentSectionElement);
   const currentSelectionActive=()=>!currentReviewDisposed&&currentSelectionEpoch===currentRenderEpoch;
   const reportReviewFailure=(currentFailureMessage:string)=>{
    if(!currentSelectionActive())return;
    updateReviewStatus(`전장 로드 실패: ${currentFailureMessage}`);
    releaseReviewSelection();
   };
   const {game:currentGameInstance,scene:currentSceneInstance}=createGame(currentCanvasElement,()=>{},()=>{
    if(!currentSelectionActive())return;
    currentCameraReady=true;
    updateReviewStatus(`${currentFieldRecord.name} 렌더링 완료 · ${currentFieldRecord.columns}×${currentFieldRecord.rows} 타일`);
   },currentFailureNotice=>reportReviewFailure(noticeText(currentFailureNotice,currentReviewOptions.locale,t)),BattlefieldReviewGame,collectMapResourceKeys(currentFieldRecord,'battle'),[...new Set(currentBattleRecord.units.map(currentUnitRecord=>currentUnitRecord.side==='enemy'?(currentUnitRecord.monsterTypeId??currentUnitRecord.appearance??'slime'):'human'))]);
   currentCameraAction=currentActionName=>{
    if(!currentCameraReady)throw new Error('전장을 불러온 뒤 화면 조정을 사용할 수 있습니다.');
    if(currentActionName==='zoom-out')currentSceneInstance.adjustZoom(-BATTLE_REVIEW_ZOOM_STEP);
    else if(currentActionName==='zoom-in')currentSceneInstance.adjustZoom(BATTLE_REVIEW_ZOOM_STEP);
    else if(currentActionName==='reset')currentSceneInstance.focus();
    else throw new Error('지원하지 않는 전장 화면 조정입니다.');
   };
   if(currentReviewOptions.controls){
    const currentCameraMenu=document.createElement('nav');currentCameraMenu.setAttribute('aria-label','맵 화면 조정');
    for(const [currentActionName,currentButtonLabel] of [['zoom-out','맵 축소'],['zoom-in','맵 확대'],['reset','시점 복귀']]){
     const currentActionButton=document.createElement('button');currentActionButton.textContent=currentButtonLabel;
     currentActionButton.onclick=()=>currentCameraAction?.(currentActionName);currentCameraMenu.append(currentActionButton);
    }
    currentSectionElement.prepend(currentCameraMenu);
   }
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
 currentFieldSelector.onchange=()=>selectReviewField(currentFieldSelector.value);
 // 이전 전체 비교 링크는 첫 번째 개별 전장으로 전환한다.
 try{selectReviewField(currentReviewOptions.field==='all'?BATTLE_REVIEW_DEFAULT_FIELD:currentReviewOptions.field);}catch(currentMountError){releaseReviewSelection();throw currentMountError;}
 return {
  readState:()=>({choices:BATTLE_REVIEW_CHOICES.map(currentChoiceRecord=>[...currentChoiceRecord]),field:currentSelectedField,status:currentReviewStatus,cameraReady:currentCameraReady}),
  selectField:selectReviewField,
  adjustCamera(currentActionName:string){if(!currentCameraAction)throw new Error('전장을 먼저 불러오세요.');currentCameraAction(currentActionName);},
  dispose(){if(currentReviewDisposed)return;currentReviewDisposed=true;releaseReviewSelection();currentReviewRoot.replaceChildren();},
 };
}
