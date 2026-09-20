import { screenFacing, type WorldFacing } from '../animation/facing';
import type {Battle, Position} from '../../client/types';
const STEP_MILLISECONDS = 180;
type Point = {x:number;y:number;depth:number};
type Track = {points:Point[];started:number;segmentWorldFacings:(WorldFacing|undefined)[]};
/** 새로 수신한 확정 이동 로그만 재생하며 초기 접속의 과거 기록은 재생하지 않는다. */
export class BattleMotion {
  private space='';
  private logCount=0;
  private positions=new Map<string,Position>();
  private tracks=new Map<string,Track>();
  clear(){this.space='';this.logCount=0;this.positions.clear();this.tracks.clear();}
  sync(space:string,battle:Battle|null,project:(p:Position, battleUnitIdentifier?: string)=>Point,now:number){
    if(!battle){this.clear();return;}
    if(space!==this.space || battle.log.length<this.logCount){
      this.clear();this.space=space;this.logCount=battle.log.length;
    }
    for(const event of battle.log.slice(this.logCount)){
      if(event.action!=='MOVE' || !event.path?.length)continue;
      if (event.pathFacings !== undefined) {
        if (event.pathFacings.length !== event.path.length) throw new Error('이동 경로와 구간별 방향 개수가 다릅니다.');
        for (const segmentWorldFacing of event.pathFacings) screenFacing(segmentWorldFacing, 0);
      }
      const old=this.positions.get(event.unitId);
      if(!old)continue;
      const track=this.tracks.get(event.unitId);
      const points=track ? [this.sample(track,now),...track.points.slice(Math.min(track.points.length,Math.floor(Math.max(0,now-track.started)/STEP_MILLISECONDS)+1))] : [project(old, event.unitId)];
      const remainingSegmentIndex = track ? Math.floor(Math.max(0,now-track.started)/STEP_MILLISECONDS) : 0;
      const segmentWorldFacings = track ? track.segmentWorldFacings.slice(remainingSegmentIndex) : [];
      segmentWorldFacings.push(...event.path.map((_, pathSegmentIndex) => event.pathFacings?.[pathSegmentIndex]));
      points.push(...event.path.map(battlePathPosition => project(battlePathPosition, event.unitId)));
      this.tracks.set(event.unitId,{points,started:now,segmentWorldFacings});
      this.positions.set(event.unitId,event.path[event.path.length-1]);
    }
    this.logCount=battle.log.length;
    for(const unit of battle.units)this.positions.set(unit.id,{...unit.position});
    for(const id of this.tracks.keys())if(!battle.units.some(u=>u.id===id && u.hp>0))this.tracks.delete(id);
  }
  currentWorldFacing(battleUnitIdentifier:string,currentRenderTime:number):WorldFacing|undefined {
    const currentMotionTrack=this.tracks.get(battleUnitIdentifier);
    if(!currentMotionTrack)return undefined;
    const currentSegmentIndex=Math.floor(Math.max(0,currentRenderTime-currentMotionTrack.started)/STEP_MILLISECONDS);
    return currentMotionTrack.segmentWorldFacings[currentSegmentIndex];
  }
  offset(id:string,now:number):Point{
    const track=this.tracks.get(id);
    if(!track)return {x:0,y:0,depth:0};
    const at=this.sample(track,now),end=track.points[track.points.length-1];
    return {x:at.x-end.x,y:at.y-end.y,depth:at.depth-end.depth};
  }
  private sample(track:Track,now:number):Point{
    const progress=Math.max(0,now-track.started)/STEP_MILLISECONDS;
    const index=Math.min(Math.floor(progress),track.points.length-1);
    const a=track.points[index],b=track.points[Math.min(index+1,track.points.length-1)],t=Math.min(1,progress-index);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,depth:a.depth+(b.depth-a.depth)*t};
  }
}
