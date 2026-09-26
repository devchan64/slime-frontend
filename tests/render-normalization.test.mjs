import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledMetricsBundle=await build({stdin:{contents:`export * from './src/game/terrain/renderMetrics';export * from './src/game/terrain/elevation';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const normalizedRenderModule=await import(`data:text/javascript;base64,${Buffer.from(compiledMetricsBundle.outputFiles[0].text).toString('base64')}`);
test('줌 1에서 기존 타일·캐릭터·고도의 화면 크기를 보존한다',()=>{
 assert.equal(normalizedRenderModule.MAP_DEFAULT_ZOOM,1);
 for(const [currentWorldSize,previousWorldSize] of [[normalizedRenderModule.MAP_TILE_WIDTH,64],[normalizedRenderModule.MAP_TILE_HEIGHT,32],[normalizedRenderModule.CHARACTER_BODY_HEIGHT,60],[normalizedRenderModule.MAP_ELEVATION_HEIGHT,24],[normalizedRenderModule.MAP_BASE_THICKNESS,12]]){
  assert.ok(Math.abs(currentWorldSize-previousWorldSize*1.3)<1e-9);
 }
});
test('높이가 있는 타일의 상대 좌표와 클릭 셀을 유지한다',()=>{
 const currentTestSurface={columns:3,rows:3,elevations:[[1,1,1],[1,1,1],[1,1,1]]};
 for(let currentRowIndex=0;currentRowIndex<3;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<3;currentColumnIndex++){
  const currentCellPosition={column:currentColumnIndex,row:currentRowIndex};
  const currentWorldPoint=normalizedRenderModule.project(currentCellPosition,currentTestSurface);
  assert.ok(Math.abs(currentWorldPoint.x-normalizedRenderModule.MAP_ORIGIN.x-(currentColumnIndex-currentRowIndex)*32*1.3)<1e-9);
  assert.ok(Math.abs(currentWorldPoint.y-normalizedRenderModule.MAP_ORIGIN.y-((currentColumnIndex+currentRowIndex)*16-24)*1.3)<1e-9);
  assert.deepEqual(normalizedRenderModule.pickSurface(currentWorldPoint.x,currentWorldPoint.y,currentTestSurface,{min:1,max:1}),currentCellPosition);
 }
});
