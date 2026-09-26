/** 카메라와 무관한 블록 면. 지붕·벽도 이 기하를 사용한다. */
export type TerrainBlockRecord = {id:string;column:number;row:number;layer:number;offsetHeight:number;height:number;shape:'full'|'ramp';highSide?:'north'|'south'|'east'|'west';material:'wall'|'roof';walkable:boolean};
export type BlockVertexPoint = {column:number;row:number;height:number};
export type BlockSurfaceFace = {vertices:BlockVertexPoint[];material:'wall'|'roof';top:boolean};
const BLOCK_LAYER_HEIGHT = 48;
const BLOCK_CORNER_OFFSETS = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
const BLOCK_NEIGHBOR_OFFSETS = [[0,-1],[1,0],[0,1],[-1,0]];
const BLOCK_HEIGHT_EPSILON = 0.00001;
export function resolveBlockSurfaceHeight(currentBlockRecord:TerrainBlockRecord,currentLocalColumn:number,currentLocalRow:number) {
 const currentBaseHeight=currentBlockRecord.layer*BLOCK_LAYER_HEIGHT+currentBlockRecord.offsetHeight;
 if(currentBlockRecord.shape!=='ramp')return currentBaseHeight+currentBlockRecord.height;
 const currentSlopeRatio={east:currentLocalColumn,west:1-currentLocalColumn,south:currentLocalRow,north:1-currentLocalRow}[currentBlockRecord.highSide!];
 return currentBaseHeight+currentBlockRecord.height*currentSlopeRatio;
}
function clipBlockSurfacePolygon(currentPolygonPoints:BlockVertexPoint[],evaluatePlaneDistance:(currentVertexPoint:BlockVertexPoint)=>number) {
 const resultingPolygonPoints:BlockVertexPoint[]=[];
 for(let currentVertexIndex=0;currentVertexIndex<currentPolygonPoints.length;currentVertexIndex++) {
  const previousVertexPoint=currentPolygonPoints[(currentVertexIndex+currentPolygonPoints.length-1)%currentPolygonPoints.length],currentVertexPoint=currentPolygonPoints[currentVertexIndex];
  const previousPlaneDistance=evaluatePlaneDistance(previousVertexPoint),currentPlaneDistance=evaluatePlaneDistance(currentVertexPoint);
  if((previousPlaneDistance>0)!==(currentPlaneDistance>0)) {
   const intersectionRatioValue=previousPlaneDistance/(previousPlaneDistance-currentPlaneDistance);
   resultingPolygonPoints.push({column:previousVertexPoint.column+(currentVertexPoint.column-previousVertexPoint.column)*intersectionRatioValue,row:previousVertexPoint.row+(currentVertexPoint.row-previousVertexPoint.row)*intersectionRatioValue,height:previousVertexPoint.height+(currentVertexPoint.height-previousVertexPoint.height)*intersectionRatioValue});
  }
  if(currentPlaneDistance>=0)resultingPolygonPoints.push(currentVertexPoint);
 }
 return resultingPolygonPoints;
}
export function buildBlockSurfaceFaces(currentBlockRecords:TerrainBlockRecord[]):BlockSurfaceFace[] {
 const currentCellIndex=new Map<string,TerrainBlockRecord[]>();
 const currentIdentifierSet=new Set<string>();
 for(const currentBlockRecord of currentBlockRecords) {
  if(currentIdentifierSet.has(currentBlockRecord.id)||!['full','ramp'].includes(currentBlockRecord.shape)||![currentBlockRecord.column,currentBlockRecord.row,currentBlockRecord.layer,currentBlockRecord.offsetHeight,currentBlockRecord.height].every(Number.isInteger)||currentBlockRecord.height!==BLOCK_LAYER_HEIGHT||currentBlockRecord.offsetHeight!==0||(currentBlockRecord.shape==='ramp'&&!['north','south','east','west'].includes(currentBlockRecord.highSide!)))throw new Error('잘못된 블록 데이터');
  currentIdentifierSet.add(currentBlockRecord.id);
  const currentCellKey=`${currentBlockRecord.column},${currentBlockRecord.row}`;
  currentCellIndex.set(currentCellKey,[...(currentCellIndex.get(currentCellKey)??[]),currentBlockRecord]);
 }
 const resultingSurfaceFaces:BlockSurfaceFace[]=[];
 for(const currentBlockRecord of currentBlockRecords) {
  const currentBaseHeight=currentBlockRecord.layer*BLOCK_LAYER_HEIGHT+currentBlockRecord.offsetHeight;
  const currentTopCorners=BLOCK_CORNER_OFFSETS.map(([currentColumnOffset,currentRowOffset])=>({column:currentBlockRecord.column+currentColumnOffset,row:currentBlockRecord.row+currentRowOffset,height:resolveBlockSurfaceHeight(currentBlockRecord,currentColumnOffset+.5,currentRowOffset+.5)}));
  const currentUpperNeighbors=currentCellIndex.get(`${currentBlockRecord.column},${currentBlockRecord.row}`)!;
  const currentTopCovered=currentUpperNeighbors.some(currentNeighborBlock=>currentNeighborBlock!==currentBlockRecord&&currentTopCorners.every(currentCornerPoint=>Math.abs(currentCornerPoint.height-(currentNeighborBlock.layer*BLOCK_LAYER_HEIGHT+currentNeighborBlock.offsetHeight))<BLOCK_HEIGHT_EPSILON));
  if(!currentTopCovered)resultingSurfaceFaces.push({vertices:currentTopCorners,material:currentBlockRecord.material,top:true});
  for(let currentEdgeIndex=0;currentEdgeIndex<4;currentEdgeIndex++) {
   const currentEdgeStart=currentTopCorners[currentEdgeIndex],currentEdgeEnd=currentTopCorners[(currentEdgeIndex+1)%4];
   let currentVisiblePolygons=[[{...currentEdgeStart,height:currentBaseHeight},{...currentEdgeEnd,height:currentBaseHeight},currentEdgeEnd,currentEdgeStart]];
   const [neighborColumnOffset,neighborRowOffset]=BLOCK_NEIGHBOR_OFFSETS[currentEdgeIndex];
   for(const currentNeighborBlock of currentCellIndex.get(`${currentBlockRecord.column+neighborColumnOffset},${currentBlockRecord.row+neighborRowOffset}`)??[]) {
    const neighborBottomHeight=currentNeighborBlock.layer*BLOCK_LAYER_HEIGHT+currentNeighborBlock.offsetHeight;
    currentVisiblePolygons=currentVisiblePolygons.flatMap(currentPolygonPoints=>[
     clipBlockSurfacePolygon(currentPolygonPoints,currentVertexPoint=>neighborBottomHeight-currentVertexPoint.height),
     clipBlockSurfacePolygon(currentPolygonPoints,currentVertexPoint=>currentVertexPoint.height-resolveBlockSurfaceHeight(currentNeighborBlock,currentVertexPoint.column-currentNeighborBlock.column+.5,currentVertexPoint.row-currentNeighborBlock.row+.5)),
    ]).filter(currentPolygonPoints=>currentPolygonPoints.length>=3);
   }
   for(const currentPolygonPoints of currentVisiblePolygons) {
    const currentHeightRange=Math.max(...currentPolygonPoints.map(currentVertexPoint=>currentVertexPoint.height))-Math.min(...currentPolygonPoints.map(currentVertexPoint=>currentVertexPoint.height));
    const currentSurfaceArea=Math.abs(currentPolygonPoints.reduce((currentAreaValue,currentVertexPoint,currentVertexIndex)=>{
     const nextVertexPoint=currentPolygonPoints[(currentVertexIndex+1)%currentPolygonPoints.length];
     const currentHorizontalValue=neighborColumnOffset===0?currentVertexPoint.column:currentVertexPoint.row;
     const nextHorizontalValue=neighborColumnOffset===0?nextVertexPoint.column:nextVertexPoint.row;
     return currentAreaValue+currentHorizontalValue*nextVertexPoint.height-nextHorizontalValue*currentVertexPoint.height;
    },0));
    if(currentHeightRange>BLOCK_HEIGHT_EPSILON&&currentSurfaceArea>BLOCK_HEIGHT_EPSILON)resultingSurfaceFaces.push({vertices:currentPolygonPoints,material:currentBlockRecord.material,top:false});
   }
  }
 }
 return resultingSurfaceFaces;
}
