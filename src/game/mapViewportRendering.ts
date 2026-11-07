import type Phaser from 'phaser';

/** 맵 일부라도 화면 밖이면 GPU 그리기만 생략하고 로더와 상태 업데이트 루프는 유지한다. */
export function observeMapViewportRendering(currentMapElement:HTMLElement,currentGameInstance:Phaser.Game){
  const originalGameStep=currentGameInstance.step;
  let currentViewportVisible=true;
  const currentViewportObserver=new IntersectionObserver(currentViewportEntries=>{
    const currentMapEntry=currentViewportEntries.find(currentViewportEntry=>currentViewportEntry.target===currentMapElement);
    if(!currentMapEntry)return;
    currentViewportVisible=currentMapEntry.isIntersecting&&currentMapEntry.intersectionRatio===1;
    currentMapElement.dataset.viewportRendering=currentViewportVisible?'active':'suspended';
  },{threshold:1});
  // postBoot에서 설정하므로 Phaser가 아래 함수를 메인 루프에 바인딩한다.
  currentGameInstance.step=function(currentFrameTime:number,currentFrameDelta:number){
    if(currentViewportVisible)originalGameStep.call(currentGameInstance,currentFrameTime,currentFrameDelta);
    else currentGameInstance.headlessStep(currentFrameTime,currentFrameDelta);
  };
  currentViewportObserver.observe(currentMapElement);
  return ()=>{currentViewportObserver.disconnect();currentGameInstance.step=originalGameStep;delete currentMapElement.dataset.viewportRendering;};
}
