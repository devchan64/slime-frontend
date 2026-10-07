import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {FIELD_RENDER_METRICS,projectSurfaceCell,buildSurfaceCliffs,buildSurfaceStairs} from '../packages/field-surface/field-surface.mjs';
const currentGameBundle=await build({entryPoints:['src/game/terrain/elevation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const currentGameModule=await import(`data:text/javascript;base64,${Buffer.from(currentGameBundle.outputFiles[0].text).toString('base64')}`);
const currentMapSurface={columns:3,rows:3,elevations:[[0,0,0],[0,1,1],[0,1,2]],elevationTiles:[{cell:{column:1,row:1},lower:{column:1,row:0}}]};
test('게임과 라이브러리가 계단·절벽·캐릭터 높이를 같은 좌표로 계산한다',()=>{
 const currentRenderOptions={...FIELD_RENDER_METRICS,originX:1040,originY:80};
 for(const currentCellPosition of [{column:1,row:1},{column:2,row:2}]){
  assert.deepEqual(currentGameModule.project(currentCellPosition,currentMapSurface),projectSurfaceCell(currentCellPosition,currentMapSurface,currentRenderOptions));
  assert.deepEqual(currentGameModule.cliffFaces(currentCellPosition,currentMapSurface),buildSurfaceCliffs(currentCellPosition,currentMapSurface,currentRenderOptions));
 }
 assert.deepEqual(currentGameModule.elevationTileFaces(currentMapSurface.elevationTiles[0],currentMapSurface),buildSurfaceStairs(currentMapSurface.elevationTiles[0],currentMapSurface,currentRenderOptions));
 assert.equal(projectSurfaceCell({column:2,row:2},currentMapSurface,FIELD_RENDER_METRICS).y,16);
});
test('4방향 회전에서 외곽 절벽 높이와 계단 상면 수를 유지한다',()=>{
 for(let currentRotationIndex=0;currentRotationIndex<4;currentRotationIndex++){
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationIndex};
  const currentStairFaces=buildSurfaceStairs(currentMapSurface.elevationTiles[0],currentMapSurface,currentRenderOptions);
  assert.equal(currentStairFaces.filter(currentFaceRecord=>currentFaceRecord.top).length,3);
  assert.ok(currentStairFaces.flatMap(currentFaceRecord=>currentFaceRecord.points).every(currentPointValue=>Number.isFinite(currentPointValue.x)&&Number.isFinite(currentPointValue.y)));
  const currentCliffFaces=buildSurfaceCliffs({column:2,row:2},currentMapSurface,currentRenderOptions);
  assert.equal(currentCliffFaces.length,2);
  for(const currentFacePoints of currentCliffFaces)assert.ok(currentFacePoints[3].y>currentFacePoints[0].y);
 }
});

test('암벽 원본 한 장은 벽 한 칸 너비와 한 단계 층고에 맞는다',async()=>{
 const {resolveCliffTextureScale}=await import('../packages/field-surface/field-surface.mjs');
 for(const currentSourceSize of [256,512]){
  const currentTextureScale=resolveCliffTextureScale(FIELD_RENDER_METRICS,currentSourceSize,currentSourceSize);
  assert.equal(currentSourceSize*currentTextureScale.scaleX,40);
  assert.equal(currentSourceSize*currentTextureScale.scaleY,32);
  assert.equal(64/(currentSourceSize*currentTextureScale.scaleY),2);
 }
 assert.throws(()=>resolveCliffTextureScale(FIELD_RENDER_METRICS,0,256));
});
