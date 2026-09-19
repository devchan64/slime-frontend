import type {Position} from '../../client/types';
const STEP_MILLISECONDS = 180;
type Point = {x:number;y:number;depth:number};
export type FieldActor = {id:string;cell:Position;point:Point};
type Track = FieldActor & {from:Point;started:number};

/** 서버 확정 인접 이동만 보간한다. 논리 좌표와 이동 판정은 변경하지 않는다. */
export class FieldMotion {
  private space='';
  private tracks=new Map<string,Track>();
  clear() { this.space='';this.tracks.clear(); }
  sync(space:string,actors:FieldActor[],now:number) {
    if(space!==this.space){this.clear();this.space=space;}
    const next=new Map<string,Track>();
    for(const actor of actors){
      const old=this.tracks.get(actor.id);
      if(old && old.cell.column===actor.cell.column && old.cell.row===actor.cell.row
          && old.point.x===actor.point.x && old.point.y===actor.point.y && old.point.depth===actor.point.depth){
        next.set(actor.id,old);continue;
      }
      const adjacent=old && Math.abs(old.cell.column-actor.cell.column)+Math.abs(old.cell.row-actor.cell.row)===1;
      const from=adjacent ? this.sample(old,now) : actor.point;
      next.set(actor.id,{...actor,cell:{...actor.cell},point:{...actor.point},from:{...from},started:now});
    }
    this.tracks=next;
  }
  offset(id:string,now:number):Point {
    const track=this.tracks.get(id);
    if(!track)return {x:0,y:0,depth:0};
    const at=this.sample(track,now);
    return {x:at.x-track.point.x,y:at.y-track.point.y,depth:at.depth-track.point.depth};
  }
  private sample(track:Track,now:number):Point {
    const t=Math.max(0,Math.min(1,(now-track.started)/STEP_MILLISECONDS));
    return {x:track.from.x+(track.point.x-track.from.x)*t,
      y:track.from.y+(track.point.y-track.from.y)*t,
      depth:track.from.depth+(track.point.depth-track.from.depth)*t};
  }
}
