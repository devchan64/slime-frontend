import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles:currentCompiledFiles}=await build({entryPoints:['src/game/terrain/sceneryDepthOrder.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {preserveSceneryDepthOrder}=await import('data:text/javascript;base64,'+Buffer.from(currentCompiledFiles[0].text).toString('base64'));
function makeSceneryObject(currentOriginalDepth,currentActualDepth,currentBounds){
 return {depth:currentActualDepth,getData(currentDataKey){return currentDataKey==='sceneryOriginalDepth'?currentOriginalDepth:undefined;},getBounds(){return currentBounds;},setDepth(currentNewDepth){this.depth=currentNewDepth;return this;}};
}
test('건물 앞으로 올라간 울타리 때문에 나무의 원래 깊이 순서가 뒤집히지 않는다',()=>{
 const currentOverlapBounds={left:0,right:100,top:0,bottom:100};
 const currentFenceObject=makeSceneryObject(2280,2611,currentOverlapBounds);
 const currentTreeObject=makeSceneryObject(2530,2530,currentOverlapBounds);
 const currentDistantObject=makeSceneryObject(2600,2600,{left:200,right:250,top:0,bottom:50});
 preserveSceneryDepthOrder([currentTreeObject,currentDistantObject,currentFenceObject]);
 assert.ok(currentTreeObject.depth>currentFenceObject.depth);
 assert.equal(currentDistantObject.depth,2600);
});
test('앞뒤로 이어지는 겹침은 순서대로 보정하고 같은 깊이는 임의로 바꾸지 않는다',()=>{
 const currentOverlapBounds={left:0,right:100,top:0,bottom:100};
 const currentRearObject=makeSceneryObject(1,100,currentOverlapBounds);
 const currentMiddleObject=makeSceneryObject(2,2,currentOverlapBounds);
 const currentFrontObject=makeSceneryObject(3,3,currentOverlapBounds);
 const currentTiedObject=makeSceneryObject(3,3,currentOverlapBounds);
 preserveSceneryDepthOrder([currentFrontObject,currentMiddleObject,currentRearObject,currentTiedObject]);
 assert.ok(currentMiddleObject.depth>currentRearObject.depth);
 assert.ok(currentFrontObject.depth>currentMiddleObject.depth);
 assert.equal(currentTiedObject.depth,currentFrontObject.depth);
});
