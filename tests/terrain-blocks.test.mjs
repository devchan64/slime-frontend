import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledBlockModule=await build({entryPoints:['src/game/terrain/blockGeometry.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {buildBlockSurfaceFaces,resolveBlockSurfaceHeight}=await import(`data:text/javascript;base64,${Buffer.from(compiledBlockModule.outputFiles[0].text).toString('base64')}`);
const createTestBlock=(currentBlockOverrides={})=>({id:'a',column:0,row:0,layer:0,offsetHeight:0,height:60,shape:'full',material:'wall',walkable:false,...currentBlockOverrides});
test('같은 높이의 이웃 블록은 공유 벽을 제거한다',()=>{
 assert.equal(buildBlockSurfaceFaces([createTestBlock(),createTestBlock({id:'b',column:1})]).length,8);
});
test('적층은 중간 윗면을 제거하고 전체 높이를 유지한다',()=>{
 const currentSurfaceFaces=buildBlockSurfaceFaces([createTestBlock(),createTestBlock({id:'b',layer:1})]);
 assert.equal(currentSurfaceFaces.filter(currentSurfaceFace=>currentSurfaceFace.top).length,1);
 assert.equal(Math.max(...currentSurfaceFaces.flatMap(currentSurfaceFace=>currentSurfaceFace.vertices.map(currentVertexPoint=>currentVertexPoint.height))),120);
});
test('반장 블록은 거부한다',()=>{assert.throws(()=>buildBlockSurfaceFaces([createTestBlock({height:24,shape:'slab'})]));});
test('네 방향 경사는 낮은 경계에서 높은 경계까지 이어진다',()=>{
 for(const [currentHighSide,currentLowPoint,currentHighPoint] of [['east',[0,.5],[1,.5]],['west',[1,.5],[0,.5]],['north',[.5,1],[.5,0]],['south',[.5,0],[.5,1]]]) {
  const currentRampBlock=createTestBlock({shape:'ramp',highSide:currentHighSide});
  assert.equal(resolveBlockSurfaceHeight(currentRampBlock,...currentLowPoint),0);
  assert.equal(resolveBlockSurfaceHeight(currentRampBlock,...currentHighPoint),60);
 }
});
test('중복 ID와 잘못된 경사 방향을 거부한다',()=>{
 assert.throws(()=>buildBlockSurfaceFaces([createTestBlock(),createTestBlock()]));
 assert.throws(()=>buildBlockSurfaceFaces([createTestBlock({shape:'ramp'})]));
});
