const TERRAIN_MAXIMUM_ELEVATION=20;
/** 교량의 지면과 상판을 구분하는 게임·검수 공통 계약. */
export function enumerateBridgeCells(currentBridgeRecord){
 const currentColumnDelta=currentBridgeRecord.end.column-currentBridgeRecord.start.column;
 const currentRowDelta=currentBridgeRecord.end.row-currentBridgeRecord.start.row;
 return Array.from({length:Math.abs(currentColumnDelta)+Math.abs(currentRowDelta)+1},(_,currentStepIndex)=>({column:currentBridgeRecord.start.column+Math.sign(currentColumnDelta)*currentStepIndex,row:currentBridgeRecord.start.row+Math.sign(currentRowDelta)*currentStepIndex}));
}
export function findBridgeSurface(currentCellPosition,currentMapSurface){
 return currentMapSurface.bridges?.find(currentBridgeRecord=>enumerateBridgeCells(currentBridgeRecord).slice(1,-1).some(currentBridgeCell=>currentBridgeCell.column===currentCellPosition.column&&currentBridgeCell.row===currentCellPosition.row));
}
export function canTraverseBridgeEdge(currentStartPosition,currentEndPosition,currentMapSurface){
 for(const currentCellPosition of [currentStartPosition,currentEndPosition]){
  const currentBridgeRecord=findBridgeSurface(currentCellPosition,currentMapSurface);
  if(!currentBridgeRecord)continue;
  const currentBridgeCells=enumerateBridgeCells(currentBridgeRecord);
  if(![currentStartPosition,currentEndPosition].every(currentEdgePosition=>currentBridgeCells.some(currentBridgeCell=>currentBridgeCell.column===currentEdgePosition.column&&currentBridgeCell.row===currentEdgePosition.row)))return false;
 }
 return true;
}
export function validateBridgeSurfaces(currentMapSurface){
 const currentSeenIdentifiers=new Set(),currentSeenPositions=new Set();
 for(const currentBridgeRecord of currentMapSurface.bridges??[]){
  if(!currentBridgeRecord||Object.keys(currentBridgeRecord).sort().join(',')!=='elevation,end,id,material,start'||!['timber','stone'].includes(currentBridgeRecord.material)||!Number.isInteger(currentBridgeRecord.elevation)||currentBridgeRecord.elevation<1||currentBridgeRecord.elevation>TERRAIN_MAXIMUM_ELEVATION||!(/^[a-z][a-z0-9-]*$/).test(currentBridgeRecord.id))throw Error('교량 필드·재질·상판 고도가 올바르지 않습니다.');
  if(currentSeenIdentifiers.has(currentBridgeRecord.id))throw Error('교량 ID 중복');currentSeenIdentifiers.add(currentBridgeRecord.id);
  for(const currentEndpointRecord of [currentBridgeRecord.start,currentBridgeRecord.end]){
   if(!currentEndpointRecord||Object.keys(currentEndpointRecord).sort().join(',')!=='column,row'||!Number.isInteger(currentEndpointRecord.column)||!Number.isInteger(currentEndpointRecord.row)||currentEndpointRecord.column<0||currentEndpointRecord.row<0||currentEndpointRecord.column>=currentMapSurface.columns||currentEndpointRecord.row>=currentMapSurface.rows)throw Error('교량 진입점 좌표 오류');
  }
  const currentColumnDelta=currentBridgeRecord.end.column-currentBridgeRecord.start.column,currentRowDelta=currentBridgeRecord.end.row-currentBridgeRecord.start.row;
  if((currentColumnDelta===0)===(currentRowDelta===0)||Math.abs(currentColumnDelta)+Math.abs(currentRowDelta)<2)throw Error('교량은 중간 상판이 있는 직선이어야 합니다.');
  const currentBridgeCells=enumerateBridgeCells(currentBridgeRecord);
  for(const [currentCellIndex,currentBridgeCell] of currentBridgeCells.entries()){
   const currentCellKey=`${currentBridgeCell.column},${currentBridgeCell.row}`;
   if(currentSeenPositions.has(currentCellKey))throw Error('교량 구간이나 진입점 중복');currentSeenPositions.add(currentCellKey);
   const currentGroundHeight=currentMapSurface.elevations[currentBridgeCell.row][currentBridgeCell.column];
   if(currentCellIndex===0||currentCellIndex===currentBridgeCells.length-1){if(Math.abs(currentGroundHeight-currentBridgeRecord.elevation)>1)throw Error('교량 진입 높이 차이 오류');}
   else if(currentGroundHeight>=currentBridgeRecord.elevation)throw Error('교량 상판은 지면보다 높아야 합니다.');
  }
 }
}
/** 검수 원본의 하부 차단 셀에서 상판만 통행 가능하게 노출한다. */
export function prepareBridgeTraversalSurface(currentMapSurface){
 if(!currentMapSurface.bridges?.length)return currentMapSurface;
 if(currentMapSurface.terrainMovementVersion!==2)throw Error('교량은 지형 이동 규칙 2에서만 지원합니다.');
 validateBridgeSurfaces(currentMapSurface);
 const currentDeckPositions=new Set(currentMapSurface.bridges.flatMap(currentBridgeRecord=>enumerateBridgeCells(currentBridgeRecord).slice(1,-1)).map(currentCellPosition=>`${currentCellPosition.column},${currentCellPosition.row}`));
 return {...currentMapSurface,blocked:currentMapSurface.blocked.filter(currentCellPosition=>!currentDeckPositions.has(`${currentCellPosition.column},${currentCellPosition.row}`))};
}
