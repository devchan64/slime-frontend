/** 건물 앞에 올린 장식 때문에 겹치는 빌보드의 기존 앞뒤 순서가 뒤집히지 않게 한다. */
type SceneryOrderObject = {depth:number;getData:(currentDataKey:string)=>unknown;getBounds:()=>{left:number;right:number;top:number;bottom:number};setDepth:(currentDepthValue:number)=>unknown};
const SCENERY_DEPTH_ORDER_GAP = 0.01;
export function preserveSceneryDepthOrder(currentSceneObjects:SceneryOrderObject[]):void {
 const currentSceneryRecords=currentSceneObjects.map(currentSceneObject=>({object:currentSceneObject,original:currentSceneObject.getData('sceneryOriginalDepth')})).filter((currentSceneryRecord):currentSceneryRecord is {object:SceneryOrderObject;original:number}=>typeof currentSceneryRecord.original==='number'&&Number.isFinite(currentSceneryRecord.original)).sort((currentLeftRecord,currentRightRecord)=>currentLeftRecord.original-currentRightRecord.original);
 for(let currentFrontIndex=0;currentFrontIndex<currentSceneryRecords.length;currentFrontIndex++){
  const currentFrontRecord=currentSceneryRecords[currentFrontIndex];
  const currentFrontBounds=currentFrontRecord.object.getBounds();
  for(let currentRearIndex=0;currentRearIndex<currentFrontIndex;currentRearIndex++){
   const currentRearRecord=currentSceneryRecords[currentRearIndex];
   if(currentRearRecord.original>=currentFrontRecord.original||currentRearRecord.object.depth<currentFrontRecord.object.depth)continue;
   const currentRearBounds=currentRearRecord.object.getBounds();
   if(currentFrontBounds.left>=currentRearBounds.right||currentRearBounds.left>=currentFrontBounds.right||currentFrontBounds.top>=currentRearBounds.bottom||currentRearBounds.top>=currentFrontBounds.bottom)continue;
   currentFrontRecord.object.setDepth(currentRearRecord.object.depth+SCENERY_DEPTH_ORDER_GAP);
  }
 }
}
