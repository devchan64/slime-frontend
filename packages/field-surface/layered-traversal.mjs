const TERRAIN_MAXIMUM_ELEVATION=20;
import {enumerateBridgeCells, validateBridgeSurfaces} from './terrain-bridges.mjs';

const LAYERED_CARDINAL_OFFSETS = [[0,-1],[-1,0],[1,0],[0,1]];
const LAYERED_MINIMUM_CLEARANCE = 2;
export function layeredPositionKey(currentCellPosition){
 return `${currentCellPosition.column},${currentCellPosition.row},${currentCellPosition.surfaceId??'ground'}`;
}
/** 기존 단층 맵과 독립된 보행면 그래프. 입력은 지면 차단 목록을 보존한다. */
export function buildLayeredTraversal(currentMapSurface){
 if(!Number.isInteger(currentMapSurface.columns)||!Number.isInteger(currentMapSurface.rows)||currentMapSurface.columns<1||currentMapSurface.rows<1||currentMapSurface.elevations?.length!==currentMapSurface.rows||currentMapSurface.elevations.some(currentHeightRow=>currentHeightRow.length!==currentMapSurface.columns||currentHeightRow.some(currentHeightValue=>!Number.isInteger(currentHeightValue)||currentHeightValue<0||currentHeightValue>TERRAIN_MAXIMUM_ELEVATION)))throw Error('다층 지면 크기·고도 오류');
 validateBridgeSurfaces(currentMapSurface);
 const currentSurfaceNodes=new Map(),currentBlockedKeys=new Set();
 const validateCellPosition=currentCellPosition=>{
  if(!currentCellPosition||Object.keys(currentCellPosition).some(currentFieldName=>!['column','row','surfaceId'].includes(currentFieldName))||!Number.isInteger(currentCellPosition.column)||!Number.isInteger(currentCellPosition.row)||currentCellPosition.column<0||currentCellPosition.row<0||currentCellPosition.column>=currentMapSurface.columns||currentCellPosition.row>=currentMapSurface.rows||('surfaceId' in currentCellPosition&&(typeof currentCellPosition.surfaceId!=='string'||!currentCellPosition.surfaceId)))throw Error('다층 위치 형식 오류');
 };
 for(const currentBlockedPosition of currentMapSurface.blocked){
  validateCellPosition(currentBlockedPosition);
  const currentPositionKey=layeredPositionKey(currentBlockedPosition);
  if(currentBlockedKeys.has(currentPositionKey))throw Error('다층 차단 위치 중복');
  currentBlockedKeys.add(currentPositionKey);
 }
 const addSurfaceNode=(currentCellPosition,currentSurfaceHeight)=>currentSurfaceNodes.set(layeredPositionKey(currentCellPosition),{position:Object.freeze(currentCellPosition),height:currentSurfaceHeight,edges:new Set()});
 for(let currentRowIndex=0;currentRowIndex<currentMapSurface.rows;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<currentMapSurface.columns;currentColumnIndex++)addSurfaceNode({column:currentColumnIndex,row:currentRowIndex,surfaceId:'ground'},currentMapSurface.elevations[currentRowIndex][currentColumnIndex]);
 for(const currentBridgeRecord of currentMapSurface.bridges??[]){
  if(currentBridgeRecord.id==='ground')throw Error('ground는 지면 예약 ID입니다.');
  for(const currentCellPosition of enumerateBridgeCells(currentBridgeRecord).slice(1,-1)){
   if(!currentBlockedKeys.has(layeredPositionKey(currentCellPosition))&&currentBridgeRecord.elevation-currentMapSurface.elevations[currentCellPosition.row][currentCellPosition.column]<LAYERED_MINIMUM_CLEARANCE)throw Error('통행 가능한 다리 아래에는 고도 2 이상의 여유가 필요합니다.');
   addSurfaceNode({...currentCellPosition,surfaceId:currentBridgeRecord.id},currentBridgeRecord.elevation);
  }
 }
 for(const currentBlockedKey of currentBlockedKeys){if(!currentSurfaceNodes.has(currentBlockedKey))throw Error('차단 위치의 보행면이 존재하지 않습니다.');currentSurfaceNodes.delete(currentBlockedKey);}
 const connectSurfaceNodes=(currentStartPosition,currentEndPosition)=>{
  const currentStartKey=layeredPositionKey(currentStartPosition),currentEndKey=layeredPositionKey(currentEndPosition);
  const currentStartNode=currentSurfaceNodes.get(currentStartKey),currentEndNode=currentSurfaceNodes.get(currentEndKey);
  if(currentStartNode&&currentEndNode&&Math.abs(currentStartNode.height-currentEndNode.height)<=1){currentStartNode.edges.add(currentEndKey);currentEndNode.edges.add(currentStartKey);}
 };
 for(const currentSurfaceNode of currentSurfaceNodes.values())if(currentSurfaceNode.position.surfaceId==='ground')for(const [currentColumnOffset,currentRowOffset] of LAYERED_CARDINAL_OFFSETS)connectSurfaceNodes(currentSurfaceNode.position,{column:currentSurfaceNode.position.column+currentColumnOffset,row:currentSurfaceNode.position.row+currentRowOffset});
 for(const currentBridgeRecord of currentMapSurface.bridges??[]){
  const currentBridgeCells=enumerateBridgeCells(currentBridgeRecord);
  if([currentBridgeCells[0],currentBridgeCells.at(-1)].some(currentCellPosition=>!currentSurfaceNodes.has(layeredPositionKey(currentCellPosition))))throw Error('다리 진입점은 통행 가능한 지면이어야 합니다.');
  const currentBridgePositions=currentBridgeCells.map((currentCellPosition,currentCellIndex)=>({...currentCellPosition,surfaceId:currentCellIndex===0||currentCellIndex===currentBridgeCells.length-1?'ground':currentBridgeRecord.id}));
  for(let currentCellIndex=1;currentCellIndex<currentBridgePositions.length;currentCellIndex++)connectSurfaceNodes(currentBridgePositions[currentCellIndex-1],currentBridgePositions[currentCellIndex]);
 }
 const requireSurfaceNode=currentCellPosition=>{
  validateCellPosition(currentCellPosition);
  const currentSurfaceNode=currentSurfaceNodes.get(layeredPositionKey(currentCellPosition));
  if(!currentSurfaceNode)throw Error('통행 가능한 보행면이 존재하지 않습니다.');
  return currentSurfaceNode;
 };
 return Object.freeze({
  listSurfacePositions:()=>[...currentSurfaceNodes.values()].map(currentSurfaceNode=>currentSurfaceNode.position),
  readSurfaceElevation:currentCellPosition=>requireSurfaceNode(currentCellPosition).height,
  listSurfaceNeighbors:currentCellPosition=>[...requireSurfaceNode(currentCellPosition).edges].map(currentPositionKey=>currentSurfaceNodes.get(currentPositionKey).position),
  canTraverseStep:(currentStartPosition,currentEndPosition)=>{requireSurfaceNode(currentEndPosition);return requireSurfaceNode(currentStartPosition).edges.has(layeredPositionKey(currentEndPosition));},
  findSurfaceRoute:(currentStartPosition,currentEndPosition)=>{
   const currentStartNode=requireSurfaceNode(currentStartPosition),currentEndNode=requireSurfaceNode(currentEndPosition);
   const currentStartKey=layeredPositionKey(currentStartNode.position),currentEndKey=layeredPositionKey(currentEndNode.position);
   const currentSearchQueue=[currentStartKey],currentParentKeys=new Map([[currentStartKey,null]]);
   for(let currentSearchIndex=0;currentSearchIndex<currentSearchQueue.length;currentSearchIndex++){
    const currentPositionKey=currentSearchQueue[currentSearchIndex];
    if(currentPositionKey===currentEndKey){const currentRoutePositions=[];for(let currentRouteKey=currentEndKey;currentRouteKey!==currentStartKey;currentRouteKey=currentParentKeys.get(currentRouteKey))currentRoutePositions.push(currentSurfaceNodes.get(currentRouteKey).position);return currentRoutePositions.reverse();}
    for(const currentNeighborKey of currentSurfaceNodes.get(currentPositionKey).edges)if(!currentParentKeys.has(currentNeighborKey)){currentParentKeys.set(currentNeighborKey,currentPositionKey);currentSearchQueue.push(currentNeighborKey);}
   }
   return null;
  },
 });
}
