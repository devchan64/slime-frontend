import type {ViewBounds} from './viewport';

const FRAME_PADDING = 12;

/** 기본 시점에서 몸체·턴 번호가 잘리지 않는 범위로 확대율을 제한한다. */
export function fitActorZoom(zoom:number,center:{x:number;y:number},viewport:{width:number;height:number},actors:ViewBounds[]) {
  let result=zoom;
  for(const actor of actors) {
    const halfWidth=Math.max(Math.abs(actor.left-center.x),Math.abs(actor.right-center.x));
    const halfHeight=Math.max(Math.abs(actor.top-center.y),Math.abs(actor.bottom-center.y));
    if(halfWidth>0)result=Math.min(result,Math.max(1,viewport.width-2*FRAME_PADDING)/(2*halfWidth));
    if(halfHeight>0)result=Math.min(result,Math.max(1,viewport.height-2*FRAME_PADDING)/(2*halfHeight));
  }
  return result;
}
