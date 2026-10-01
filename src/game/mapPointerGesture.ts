export type MapPointerGesture = {
  currentPointerIdentifier:number;
  currentStartPositionX:number;
  currentStartPositionY:number;
  currentDragOccurred:boolean;
};
export function updateMapPointerGesture(currentGestureState:MapPointerGesture,currentPointerIdentifier:number,currentPointerPositionX:number,currentPointerPositionY:number,currentDragThreshold:number):boolean {
  if(currentGestureState.currentPointerIdentifier!==currentPointerIdentifier)return false;
  if(Math.hypot(currentPointerPositionX-currentGestureState.currentStartPositionX,currentPointerPositionY-currentGestureState.currentStartPositionY)>=currentDragThreshold)
    currentGestureState.currentDragOccurred=true;
  return true;
}
