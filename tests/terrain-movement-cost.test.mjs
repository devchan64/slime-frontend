import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles:compiledModuleOutputs}=await build({stdin:{contents:`export * from './src/ui/fieldNavigation';export * from './src/ui/terrainMovementCost';export {fieldTerrainAt,buildMeadowRoad} from './src/game/terrain/meadow';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {fieldRoute,encounterRoute,fieldMovementEstimate,fieldTerrainAt,buildMeadowRoad}=await import(`data:text/javascript;base64,${Buffer.from(compiledModuleOutputs[0].text).toString('base64')}`);
function createWeightedTestMap(){
 return {columns:6,rows:3,startPoint:{column:0,row:1},connections:[],blocked:Array.from({length:6},(_,terrainColumnIndex)=>({column:terrainColumnIndex,row:2})),terrainRows:['pppppp','gmmmmg','wwwwww'],terrainCodes:{p:'road',g:'grass',m:'mud',w:'water'},movementCosts:{version:1,rows:[
 {tileId:'road',fp:{baseCost:1,extraChanceBasisPoints:0,extraCost:0}},
 {tileId:'grass',fp:{baseCost:1,extraChanceBasisPoints:500,extraCost:1}},
 {tileId:'mud',fp:{baseCost:1,extraChanceBasisPoints:4000,extraCost:2}},
 {tileId:'water',fp:null}]}};
}
test('FP 기대 비용이 적은 긴 길을 선택하고 출발 타일은 과금하지 않는다',()=>{
 const fieldMapDefinition=createWeightedTestMap();
 const selectedRouteCells=fieldRoute(fieldMapDefinition.startPoint,{column:5,row:1},fieldMapDefinition);
 assert.equal(selectedRouteCells.length,7);
 assert.deepEqual(fieldMovementEstimate(fieldMapDefinition,selectedRouteCells),{base:7,expected:7.05,max:8});
 assert.deepEqual(fieldMovementEstimate(fieldMapDefinition,[]),{base:0,expected:0,max:0});
 assert.equal(fieldRoute(fieldMapDefinition.startPoint,{column:2,row:2},fieldMapDefinition),null);
 for(let repeatedRouteIndex=0;repeatedRouteIndex<4;repeatedRouteIndex++)assert.deepEqual(fieldRoute(fieldMapDefinition.startPoint,{column:5,row:1},fieldMapDefinition),selectedRouteCells);
});
test('몬스터가 있는 칸은 통과하지 않고 비용 정의 누락은 즉시 실패한다',()=>{
 const fieldMapDefinition=createWeightedTestMap(),monsterCellPosition={column:3,row:1};
 const selectedRouteCells=encounterRoute(fieldMapDefinition.startPoint,monsterCellPosition,fieldMapDefinition);
 assert.ok(selectedRouteCells.length>0);
 assert.ok(selectedRouteCells.every(targetCellPosition=>targetCellPosition.column!==3||targetCellPosition.row!==1));
 fieldMapDefinition.movementCosts.rows=fieldMapDefinition.movementCosts.rows.filter(terrainCostDefinition=>terrainCostDefinition.tileId!=='road');
 assert.throws(()=>fieldRoute(fieldMapDefinition.startPoint,{column:5,row:1},fieldMapDefinition),/FP 비용/);
});
test('서버 타일을 표시와 도로 연결의 원본으로 사용한다',()=>{
 const fieldMapDefinition={columns:3,rows:1,startPoint:{column:0,row:0},connections:[],blocked:[],terrainRows:['gpd'],terrainCodes:{g:'grass',p:'road',d:'dew'}};
 const serverRoadCells=buildMeadowRoad(fieldMapDefinition);
 assert.deepEqual([...serverRoadCells],['1,0']);
 assert.equal(fieldTerrainAt(fieldMapDefinition,0,0,serverRoadCells),'grass');
 assert.equal(fieldTerrainAt(fieldMapDefinition,1,0,serverRoadCells),'road');
 assert.equal(fieldTerrainAt(fieldMapDefinition,2,0,serverRoadCells),'dew');
 assert.throws(()=>fieldTerrainAt(fieldMapDefinition,3,0,serverRoadCells));
});
