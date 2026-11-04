import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles:currentCompiledFiles}=await build({entryPoints:['src/game/terrain/buildingEntranceMarker.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {resolveBuildingEntranceMarker}=await import('data:text/javascript;base64,'+Buffer.from(currentCompiledFiles[0].text).toString('base64'));
test('등록 건물의 표시 크기와 위치에 따라 출입문 지점이 함께 이동한다',()=>{
 const currentBounds={left:100,top:200,width:500,height:300};
 const currentMarker=resolveBuildingEntranceMarker('town-stonewarm-guild-v5',currentBounds,{x:0,y:0});
 assert.deepEqual(currentMarker,{x:260,y:464});
 const currentScaled=resolveBuildingEntranceMarker('town-stonewarm-guild-v5',{left:10,top:20,width:1000,height:600},{x:0,y:0});
 assert.deepEqual(currentScaled,{x:330,y:548});
});
test('다른 건물은 기존 입구 타일 좌표를 유지한다',()=>{
 const currentTilePoint={x:40,y:80};
 assert.deepEqual(resolveBuildingEntranceMarker('town-other-v1',{left:0,top:0,width:10,height:10},currentTilePoint),currentTilePoint);
});
