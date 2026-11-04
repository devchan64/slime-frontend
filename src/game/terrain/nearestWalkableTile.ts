import type {Position, State} from '../../client/types';

/** 화면 클릭 좌표에서 가장 가까운 이동 가능 타일 중심을 찾는다. */
export function findNearestWalkableTile(currentClickPoint:{x:number;y:number}, currentMapSurface:State['map'], projectTilePosition:(currentTilePosition:Position)=>{x:number;y:number}):Position | null {
 const currentBlockedKeys = new Set(currentMapSurface.blocked.map(currentBlockedPosition=>`${currentBlockedPosition.column},${currentBlockedPosition.row}`));
 let nearestTilePosition:Position | null = null;
 let nearestTileDistance = Infinity;
 for(let currentRowIndex=0;currentRowIndex<currentMapSurface.rows;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<currentMapSurface.columns;currentColumnIndex++){
  if(currentBlockedKeys.has(`${currentColumnIndex},${currentRowIndex}`))continue;
  const currentTilePosition={column:currentColumnIndex,row:currentRowIndex};
  const currentTilePoint=projectTilePosition(currentTilePosition);
  const currentTileDistance=(currentTilePoint.x-currentClickPoint.x)**2+(currentTilePoint.y-currentClickPoint.y)**2;
  if(currentTileDistance<nearestTileDistance){nearestTileDistance=currentTileDistance;nearestTilePosition=currentTilePosition;}
 }
 return nearestTilePosition;
}
