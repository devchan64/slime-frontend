/** 브라우저가 입력을 취소하면 미완료 선택을 폐기하고 장면 종료 시 리스너를 회수한다. */
export function bindMapGestureCancellation(currentCanvasTarget:EventTarget,currentDocumentTarget:Document,currentWindowTarget:Window,currentCancelGesture:()=>void):()=>void {
  const cancelHiddenMapGesture=()=>{if(currentDocumentTarget.hidden)currentCancelGesture();};
  const currentCancelEvents=['pointercancel','touchcancel'];
  for(const currentEventName of currentCancelEvents)currentCanvasTarget.addEventListener(currentEventName,currentCancelGesture,{capture:true});
  currentDocumentTarget.addEventListener('visibilitychange',cancelHiddenMapGesture);
  currentWindowTarget.addEventListener('blur',currentCancelGesture);
  return ()=>{
    for(const currentEventName of currentCancelEvents)currentCanvasTarget.removeEventListener(currentEventName,currentCancelGesture,{capture:true});
    currentDocumentTarget.removeEventListener('visibilitychange',cancelHiddenMapGesture);
    currentWindowTarget.removeEventListener('blur',currentCancelGesture);
  };
}
