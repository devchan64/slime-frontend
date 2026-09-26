import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledMetricsBundle=await build({stdin:{contents:`export * from './src/game/terrain/renderMetrics';export * from './src/game/terrain/elevation';export * from './src/game/terrain/rotation';export * from './src/game/terrain/renderPlan';export * from './src/game/terrain/viewport';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const normalizedRenderModule=await import(`data:text/javascript;base64,${Buffer.from(compiledMetricsBundle.outputFiles[0].text).toString('base64')}`);
test('정수 크기로 필드·전투 80×40, 마을 160×80, 사람 높이 80을 사용한다',()=>{
 assert.equal(normalizedRenderModule.MAP_DEFAULT_ZOOM,1);
 assert.equal(normalizedRenderModule.CHARACTER_BODY_HEIGHT,80);
 assert.deepEqual(normalizedRenderModule.resolveMapTileSize({}),{width:80,height:40});
 assert.deepEqual(normalizedRenderModule.resolveMapTileSize({safeTown:true}),{width:160,height:80});
 assert.equal(normalizedRenderModule.MAP_ELEVATION_HEIGHT,31);
 assert.equal(normalizedRenderModule.MAP_BASE_THICKNESS,16);
});
test('마을과 필드의 네 방향 회전·투영·클릭·화면 타일 범위가 같은 크기를 사용한다',()=>{
 for(const currentTownFlag of [false,true])for(const currentViewRotation of [0,1,2,3]){
  const currentTestSurface=normalizedRenderModule.rotatedSurface({columns:5,rows:3,safeTown:currentTownFlag,elevations:Array.from({length:3},()=>Array(5).fill(1))},currentViewRotation);
  const currentExpectedWidth=currentTownFlag?160:80;
  const currentExpectedHeight=currentTownFlag?80:40;
  for(let currentRowIndex=0;currentRowIndex<currentTestSurface.rows;currentRowIndex++)for(let currentColumnIndex=0;currentColumnIndex<currentTestSurface.columns;currentColumnIndex++){
   const currentCellPosition={column:currentColumnIndex,row:currentRowIndex};
   const currentWorldPoint=normalizedRenderModule.project(currentCellPosition,currentTestSurface);
   assert.equal(currentWorldPoint.x-normalizedRenderModule.MAP_ORIGIN.x,(currentColumnIndex-currentRowIndex)*currentExpectedWidth/2);
   assert.equal(currentWorldPoint.y-normalizedRenderModule.MAP_ORIGIN.y,(currentColumnIndex+currentRowIndex)*currentExpectedHeight/2-31);
   assert.deepEqual(normalizedRenderModule.pickSurface(currentWorldPoint.x,currentWorldPoint.y,currentTestSurface,{min:1,max:1}),currentCellPosition);
   const currentVisibleWindow=normalizedRenderModule.terrainWindow(currentTestSurface,{min:1,max:1},{left:currentWorldPoint.x-1,right:currentWorldPoint.x+1,top:currentWorldPoint.y-1,bottom:currentWorldPoint.y+1});
   assert.ok(currentVisibleWindow.firstColumn<=currentColumnIndex&&currentVisibleWindow.lastColumn>=currentColumnIndex);
   assert.ok(currentVisibleWindow.firstRow<=currentRowIndex&&currentVisibleWindow.lastRow>=currentRowIndex);
  }
 }
});
test('마을에서 전투로 전환한 뒤 복귀하면 지형 크기와 캐시를 올바르게 바꾼다',()=>{
 const currentGameState={map:{id:'town',safeTown:true,columns:5,rows:3,blocked:[],connections:[]},battle:null};
 const currentTownPlan=normalizedRenderModule.prepareTerrain(currentGameState,1,null);
 assert.equal(normalizedRenderModule.resolveMapTileSize(currentTownPlan.surface).width,160);
 currentGameState.battle={field:{columns:5,rows:3},blocked:[]};
 const currentBattlePlan=normalizedRenderModule.prepareTerrain(currentGameState,1,currentTownPlan);
 assert.notEqual(currentBattlePlan,currentTownPlan);
 assert.equal(normalizedRenderModule.resolveMapTileSize(currentBattlePlan.surface).width,80);
 currentGameState.battle=null;
 const currentReturnPlan=normalizedRenderModule.prepareTerrain(currentGameState,1,currentBattlePlan);
 assert.equal(normalizedRenderModule.resolveMapTileSize(currentReturnPlan.surface).width,160);
});
