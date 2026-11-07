import type Phaser from 'phaser';

let currentMapViewportStatus:'active'|'suspended'|'unmounted'='unmounted';
const viewportStatusListeners=new Set<()=>void>();
export function readMapViewportStatus(){return currentMapViewportStatus;}
export function subscribeMapViewportStatus(currentStatusListener:()=>void){viewportStatusListeners.add(currentStatusListener);return ()=>{viewportStatusListeners.delete(currentStatusListener);};}
function publishMapViewportStatus(currentNextStatus:typeof currentMapViewportStatus){
  if(currentMapViewportStatus===currentNextStatus)return;
  currentMapViewportStatus=currentNextStatus;viewportStatusListeners.forEach(currentStatusListener=>currentStatusListener());
}

/** 맵 일부라도 화면 밖이면 GPU 그리기만 생략하고 로더와 상태 업데이트 루프는 유지한다. */
export function observeMapViewportRendering(currentMapElement:HTMLElement,currentGameInstance:Phaser.Game){
  const originalGameStep=currentGameInstance.step;
  let currentViewportVisible=false;
  const currentMapStage=currentMapElement.closest<HTMLElement>('.map-stage')??currentMapElement;
  const originalStageInert=currentMapStage.inert;
  const originalInputEnabled=currentGameInstance.input.enabled;
  function applyViewportVisibility(currentNextVisible:boolean){
    currentViewportVisible=currentNextVisible;
    currentMapElement.dataset.viewportRendering=currentNextVisible?'active':'suspended';
    currentMapStage.dataset.viewportRendering=currentNextVisible?'active':'suspended';
    currentMapStage.inert=currentNextVisible?originalStageInert:true;
    currentGameInstance.input.enabled=currentNextVisible?originalInputEnabled:false;
    if(!currentNextVisible)currentGameInstance.canvas.dispatchEvent(new Event('pointercancel'));
    publishMapViewportStatus(currentNextVisible?'active':'suspended');
  }
  applyViewportVisibility(false);
  const currentViewportObserver=new IntersectionObserver(currentViewportEntries=>{
    const currentMapEntry=currentViewportEntries.find(currentViewportEntry=>currentViewportEntry.target===currentMapElement);
    if(!currentMapEntry)return;
    // 복귀 후 첫 최신 프레임이 그려질 때 입력을 다시 연다.
    currentViewportVisible=currentMapEntry.isIntersecting&&currentMapEntry.intersectionRatio===1;
    if(!currentViewportVisible)applyViewportVisibility(false);
  },{threshold:1});
  // postBoot에서 설정하므로 Phaser가 아래 함수를 메인 루프에 바인딩한다.
  currentGameInstance.step=function(currentFrameTime:number,currentFrameDelta:number){
    if(currentViewportVisible){originalGameStep.call(currentGameInstance,currentFrameTime,currentFrameDelta);if(currentMapViewportStatus!=='active')applyViewportVisibility(true);}
    else currentGameInstance.headlessStep(currentFrameTime,currentFrameDelta);
  };
  currentViewportObserver.observe(currentMapElement);
  return ()=>{currentViewportObserver.disconnect();currentGameInstance.step=originalGameStep;delete currentMapElement.dataset.viewportRendering;delete currentMapStage.dataset.viewportRendering;currentMapStage.inert=originalStageInert;currentGameInstance.input.enabled=originalInputEnabled;publishMapViewportStatus('unmounted');};
}
