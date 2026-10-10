import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGuardDisplayPlacement,projectGuardDisplayCenter} from './guard-placement.mjs';
const createTestMap=()=>({id:'fixture',columns:6,rows:6,terrainRows:Array(6).fill('ggpggg'),terrainCodes:{g:'grass',p:'road',w:'water'},elevations:Array.from({length:6},()=>Array(6).fill(0)),blocked:[]});
test('경비센터는 도로 옆 네 셀의 가운데에 배치한다',()=>{
 const currentMapRecord=createTestMap();
 const currentPlacementRecord=resolveGuardDisplayPlacement({column:2,row:0},currentMapRecord);
 assert.equal(currentPlacementRecord.width,2);assert.equal(currentPlacementRecord.height,2);
 assert.equal(currentPlacementRecord.cells.length,4);
 assert(currentPlacementRecord.cells.every(currentCell=>currentMapRecord.terrainRows[currentCell.row][currentCell.column]!=='p'));
 assert.equal(currentPlacementRecord.position.column%1,.5);assert.equal(currentPlacementRecord.position.row%1,.5);
 const currentProjectedCenter=projectGuardDisplayCenter(currentPlacementRecord,currentCell=>({x:currentCell.column*80,y:currentCell.row*40-80}));
 assert.deepEqual(currentProjectedCenter,{x:currentPlacementRecord.position.column*80,y:currentPlacementRecord.position.row*40-80});
});
test('물·막힌 셀·계단·높이 차이가 있는 공간은 제외한다',()=>{
 const currentMapRecord=createTestMap();currentMapRecord.blocked=[{column:0,row:0}];
 currentMapRecord.elevations[0][3]=1;currentMapRecord.elevationTiles=[{cell:{column:3,row:1}}];
 const currentPlacementRecord=resolveGuardDisplayPlacement({column:2,row:0},currentMapRecord);
 assert(currentPlacementRecord.cells.every(currentCell=>currentCell.row>=1&&!(currentCell.column===3&&currentCell.row===1)));
 currentMapRecord.terrainRows=Array(6).fill('wwpwww');
 assert.throws(()=>resolveGuardDisplayPlacement({column:2,row:0},currentMapRecord),/2×2/);
});
