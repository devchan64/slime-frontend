import {projectSurfaceVertex,rotateSurfacePosition} from './field-surface.mjs';
/** 보행면 높이를 명시하여 상판과 하부 캐릭터를 같은 좌표에서 따로 투영한다. */
export function projectLayeredPosition(currentCellPosition,currentTraversalGraph,currentRenderOptions){
 return projectSurfaceVertex({...currentCellPosition,height:currentTraversalGraph.readSurfaceElevation(currentCellPosition)*currentRenderOptions.elevationHeight},currentRenderOptions);
}
/** 선택 중인 보행면만 검사한다. 가려진 하부 선택은 UI의 명시적 층 선택을 요구한다. */
export function pickLayeredPosition(currentScreenPoint,currentSurfaceIdentifier,currentTraversalGraph,currentRenderOptions){
 if(typeof currentSurfaceIdentifier!=='string'||!currentSurfaceIdentifier)throw Error('선택할 보행면 ID가 필요합니다.');
 const currentSurfacePositions=currentTraversalGraph.listSurfacePositions().filter(currentCellPosition=>currentCellPosition.surfaceId===currentSurfaceIdentifier);
 if(!currentSurfacePositions.length)throw Error('선택할 보행면이 존재하지 않습니다.');
 const currentOrderedPositions=currentSurfacePositions.map(currentCellPosition=>({position:currentCellPosition,point:projectLayeredPosition(currentCellPosition,currentTraversalGraph,currentRenderOptions)})).sort((currentFirstRecord,currentSecondRecord)=>{const currentFirstView=rotateSurfacePosition(currentFirstRecord.position,currentRenderOptions.rotation??0),currentSecondView=rotateSurfacePosition(currentSecondRecord.position,currentRenderOptions.rotation??0);return currentSecondView.column+currentSecondView.row-currentFirstView.column-currentFirstView.row;});
 for(const currentPositionRecord of currentOrderedPositions)if(Math.abs(currentScreenPoint.x-currentPositionRecord.point.x)/(currentRenderOptions.tileWidth/2)+Math.abs(currentScreenPoint.y-currentPositionRecord.point.y)/(currentRenderOptions.tileHeight/2)<=1)return currentPositionRecord.position;
 return null;
}
