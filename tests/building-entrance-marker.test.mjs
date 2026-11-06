import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles:currentCompiledFiles}=await build({entryPoints:['src/game/terrain/buildingEntranceMarker.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {resolveBuildingEntranceMarker}=await import('data:text/javascript;base64,'+Buffer.from(currentCompiledFiles[0].text).toString('base64'));
test('이전 문턱 보정 대상도 출입구 타일 중앙을 사용한다',()=>{
 for(const currentTextureIdentifier of ['town-grainstead-guild-guide-v2','town-grainstead-inn-guide-v2','town-stonewarm-guild-v5','town-other-v1']){
  const currentTilePoint={x:40,y:80};
  assert.deepEqual(resolveBuildingEntranceMarker(currentTextureIdentifier,{left:100,top:200,width:500,height:300},currentTilePoint),currentTilePoint);
 }
});
test('이미지 크기와 앵커 보정은 마커 위치에 영향을 주지 않고 투영된 확대 좌표를 따른다',()=>{
 assert.deepEqual(resolveBuildingEntranceMarker('town-grainstead-guild-guide-v2',{left:10,top:20,width:1000,height:600},{x:80,y:160}),{x:80,y:160});
});
