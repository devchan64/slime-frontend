import {FIELD_ROAD_TERRAINS,isFieldRoadTerrain} from './road-materials.mjs';
/** 경비센터는 도로 옆 평평한 2×2 지면을 차지하며 네 셀 중심에 표시한다. */
export const GUARD_CENTER_FOOTPRINT_SIZE = 2;
const GUARD_FORBIDDEN_TERRAIN = new Set([...FIELD_ROAD_TERRAINS,'water','shallow-water','deep-water','wall','boulder','tree-base']);
const GUARD_NEIGHBOR_OFFSETS = [[1,0],[-1,0],[0,1],[0,-1]];
export function resolveGuardDisplayPlacement(currentGatePosition,currentMapRecord){
 if(!currentMapRecord.terrainRows||!currentMapRecord.terrainCodes)throw Error('경비센터 배치에 지형 데이터가 필요합니다.');
 const currentBlockedCells=new Set((currentMapRecord.blocked??[]).map(currentCell=>`${currentCell.column},${currentCell.row}`));
 const currentStairCells=new Set((currentMapRecord.elevationTiles??[]).map(currentStair=>`${currentStair.cell.column},${currentStair.cell.row}`));
 const readCurrentTerrain=(currentColumn,currentRow)=>currentMapRecord.terrainCodes[currentMapRecord.terrainRows[currentRow]?.[currentColumn]];
 const currentCandidateRecords=[];
 for(let currentRow=0;currentRow<currentMapRecord.rows-1;currentRow++)for(let currentColumn=0;currentColumn<currentMapRecord.columns-1;currentColumn++){
  const currentFootprintCells=[{column:currentColumn,row:currentRow},{column:currentColumn+1,row:currentRow},{column:currentColumn,row:currentRow+1},{column:currentColumn+1,row:currentRow+1}];
  const currentBaseHeight=currentMapRecord.elevations?.[currentRow]?.[currentColumn]??0;
  if(currentFootprintCells.some(currentCell=>!readCurrentTerrain(currentCell.column,currentCell.row)||GUARD_FORBIDDEN_TERRAIN.has(readCurrentTerrain(currentCell.column,currentCell.row))||currentBlockedCells.has(`${currentCell.column},${currentCell.row}`)||currentStairCells.has(`${currentCell.column},${currentCell.row}`)||(currentMapRecord.elevations?.[currentCell.row]?.[currentCell.column]??0)!==currentBaseHeight))continue;
  if(!currentFootprintCells.some(currentCell=>GUARD_NEIGHBOR_OFFSETS.some(([currentColumnOffset,currentRowOffset])=>isFieldRoadTerrain(readCurrentTerrain(currentCell.column+currentColumnOffset,currentCell.row+currentRowOffset))&&(currentMapRecord.elevations?.[currentCell.row+currentRowOffset]?.[currentCell.column+currentColumnOffset]??0)===currentBaseHeight)))continue;
  const currentCenterPosition={column:currentColumn+.5,row:currentRow+.5};
  const currentGateDistance=Math.abs(currentCenterPosition.column-currentGatePosition.column)+Math.abs(currentCenterPosition.row-currentGatePosition.row);
  currentCandidateRecords.push({position:currentCenterPosition,cells:currentFootprintCells,width:GUARD_CENTER_FOOTPRINT_SIZE,height:GUARD_CENTER_FOOTPRINT_SIZE,distance:currentGateDistance});
 }
 currentCandidateRecords.sort((currentLeft,currentRight)=>currentLeft.distance-currentRight.distance||currentLeft.position.row-currentRight.position.row||currentLeft.position.column-currentRight.position.column);
 if(!currentCandidateRecords.length)throw Error('도로 옆에 경비센터를 놓을 평평한 2×2 지면이 없습니다: '+currentMapRecord.id);
 return currentCandidateRecords[0];
}
export function projectGuardDisplayCenter(currentPlacementRecord,projectCurrentCell){
 const currentScreenPoints=currentPlacementRecord.cells.map(projectCurrentCell);
 return {x:currentScreenPoints.reduce((currentTotal,currentPoint)=>currentTotal+currentPoint.x,0)/4,y:currentScreenPoints.reduce((currentTotal,currentPoint)=>currentTotal+currentPoint.y,0)/4};
}
