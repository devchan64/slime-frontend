import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentGestureBuild=await build({entryPoints:['src/game/mapPointerGesture.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {updateMapPointerGesture}=await import(`data:text/javascript;base64,${Buffer.from(currentGestureBuild.outputFiles[0].text).toString('base64')}`);
function createPointerGesture(){return {currentPointerIdentifier:1,currentStartPositionX:100,currentStartPositionY:100,currentDragOccurred:false};}
test('드래그 후 시작점으로 돌아와도 클릭으로 되돌리지 않는다',()=>{
 const currentGestureState=createPointerGesture();
 assert.equal(updateMapPointerGesture(currentGestureState,1,110,100,6),true);
 assert.equal(currentGestureState.currentDragOccurred,true);
 updateMapPointerGesture(currentGestureState,1,100,100,6);
 assert.equal(currentGestureState.currentDragOccurred,true);
});
test('다른 손가락 이동과 해제는 진행 중 선택에 영향을 주지 않는다',()=>{
 const currentGestureState=createPointerGesture();
 assert.equal(updateMapPointerGesture(currentGestureState,2,500,500,6),false);
 assert.equal(currentGestureState.currentDragOccurred,false);
 assert.equal(updateMapPointerGesture(currentGestureState,1,103,103,6),true);
 assert.equal(currentGestureState.currentDragOccurred,false);
});
test('마지막 해제 위치에서 임계값을 넘으면 드래그로 판정한다',()=>{
 const currentGestureState=createPointerGesture();
 updateMapPointerGesture(currentGestureState,1,106,100,6);
 assert.equal(currentGestureState.currentDragOccurred,true);
});
