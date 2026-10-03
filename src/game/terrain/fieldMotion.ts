import {calculateTileMovementProgress, FIELD_TILE_MOVEMENT_DURATION_MS} from './movementTransition';
import {screenFacing, type WorldFacing} from '../animation/facing';
import type {Position} from '../../client/types';
type Point = {x:number;y:number;depth:number};
export type FieldActor = {id:string;cell:Position;point:Point;serverWorldFacing?:WorldFacing};
type Track = FieldActor & {movementPathPoints:Point[];segmentWorldFacings:(WorldFacing|undefined)[];started:number};

/** 서버 확정 인접 이동만 보간한다. 논리 좌표와 이동 판정은 변경하지 않는다. */
export class FieldMotion {
  private space='';
  private tracks=new Map<string,Track>();
  clear() { this.space='';this.tracks.clear(); }
  sync(space:string,actors:FieldActor[],now:number) {
    if(space!==this.space){this.clear();this.space=space;}
    const next=new Map<string,Track>();
    for(const actor of actors){
      if(actor.serverWorldFacing !== undefined)screenFacing(actor.serverWorldFacing,0);
      const old=this.tracks.get(actor.id);
      if(old && old.cell.column===actor.cell.column && old.cell.row===actor.cell.row
          && old.point.x===actor.point.x && old.point.y===actor.point.y && old.point.depth===actor.point.depth){
        next.set(actor.id,old);continue;
      }
      const adjacent=old && Math.abs(old.cell.column-actor.cell.column)+Math.abs(old.cell.row-actor.cell.row)===1;
      const currentMotionTrack=adjacent && this.isMovementActive(actor.id,now) ? old : undefined;
      const completedSegmentCount=currentMotionTrack ? Math.floor(Math.max(0,now-currentMotionTrack.started)/FIELD_TILE_MOVEMENT_DURATION_MS) : 0;
      const currentMovementStart=currentMotionTrack ? currentMotionTrack.started+completedSegmentCount*FIELD_TILE_MOVEMENT_DURATION_MS : now;
      const movementPathPoints=currentMotionTrack ? currentMotionTrack.movementPathPoints.slice(completedSegmentCount)
        : adjacent ? [{...old.point}] : [];
      const segmentWorldFacings=currentMotionTrack ? currentMotionTrack.segmentWorldFacings.slice(completedSegmentCount) : [];
      if(adjacent)segmentWorldFacings.push(actor.serverWorldFacing);
      movementPathPoints.push({...actor.point});
      next.set(actor.id,{...actor,cell:{...actor.cell},point:{...actor.point},movementPathPoints,segmentWorldFacings,started:currentMovementStart});
    }
    this.tracks=next;
  }
  currentWorldFacing(actorStableIdentifier:string,currentRenderTime:number):WorldFacing|undefined {
    const currentMotionTrack=this.tracks.get(actorStableIdentifier);
    if(!currentMotionTrack)return undefined;
    const currentSegmentIndex=Math.floor(Math.max(0,currentRenderTime-currentMotionTrack.started)/FIELD_TILE_MOVEMENT_DURATION_MS);
    return currentMotionTrack.segmentWorldFacings[currentSegmentIndex];
  }
  movementElapsedMilliseconds(actorStableIdentifier:string,currentRenderTime:number):number|undefined {
    if(!this.isMovementActive(actorStableIdentifier,currentRenderTime))return undefined;
    return Math.max(0,currentRenderTime-this.tracks.get(actorStableIdentifier)!.started);
  }
  isMovementActive(actorStableIdentifier:string,currentRenderTime:number):boolean {
    const currentMotionTrack=this.tracks.get(actorStableIdentifier);
    if(!currentMotionTrack)return false;
    return currentRenderTime < currentMotionTrack.started + (currentMotionTrack.movementPathPoints.length-1)*FIELD_TILE_MOVEMENT_DURATION_MS;
  }
  offset(id:string,now:number):Point {
    const track=this.tracks.get(id);
    if(!track)return {x:0,y:0,depth:0};
    const at=this.sample(track,now);
    return {x:at.x-track.point.x,y:at.y-track.point.y,depth:at.depth-track.point.depth};
  }
  private sample(track:Track,now:number):Point {
    const elapsedSegmentCount=Math.max(0,now-track.started)/FIELD_TILE_MOVEMENT_DURATION_MS;
    const currentSegmentIndex=Math.min(Math.floor(elapsedSegmentCount),track.movementPathPoints.length-1);
    const segmentStartPoint=track.movementPathPoints[currentSegmentIndex];
    const segmentTargetPoint=track.movementPathPoints[Math.min(currentSegmentIndex+1,track.movementPathPoints.length-1)];
    const currentSegmentProgress=calculateTileMovementProgress(elapsedSegmentCount-currentSegmentIndex);
    return {x:segmentStartPoint.x+(segmentTargetPoint.x-segmentStartPoint.x)*currentSegmentProgress,
      y:segmentStartPoint.y+(segmentTargetPoint.y-segmentStartPoint.y)*currentSegmentProgress,
      // 이동 중 겹치는 두 바닥 타일 위에 유지한다. 위치 보간과 그리기 순서는 구분한다.
      depth:Math.max(segmentStartPoint.depth,segmentTargetPoint.depth)};
  }
}
