import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/renderPlan.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {terrainRenderSignature,overlayCells,prepareTerrain}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const field=()=>({map:{id:'meadow',name:'초원',columns:1000,rows:1000,startPoint:{column:2,row:2},safeRadius:3,blocked:[],connections:[{column:999,row:500,targetName:'숲'}]},battle:null});
test('큰 필드도 안전구간과 선택 셀만 동적 표시한다',()=>{
 const state=field();const cells=overlayCells(state,true,{column:999,row:999},[]);
 assert.equal(cells.length,24);
 assert.ok(cells.some(p=>p.column===999&&p.row===999));
 assert.ok(cells.every(p=>p.column>=0&&p.row>=0));
 const smaller=field();smaller.map.columns=32;smaller.map.rows=32;
 assert.equal(overlayCells(smaller,true,null,[]).length,23);
});
test('전투의 서버 이동·도착 사거리·선택만 중복 없이 표시한다',()=>{
 const state=field();state.battle={field:{columns:1000,rows:1000,cells:[]},blocked:[]};
 assert.deepEqual(overlayCells(state,true,{column:1,row:2},[new Set(['1,2','3,4']),new Set(['3,4','999,999','1000,0'])]),
  [{column:1,row:2},{column:3,row:4},{column:999,row:999}]);
 state.battle.field={columns:5,rows:5};
 assert.equal(overlayCells(state,false,null,[]).length,25);
});
test('번역·이벤트 갱신은 지형 캐시를 유지하고 지형·회전 변경만 무효화한다',()=>{
 const state=field();const key=terrainRenderSignature(state,0);
 state.map.name='Dew Meadow';state.map.connections[0].targetName='Forest';state.me={fp:50};
 assert.equal(terrainRenderSignature(state,0),key);
 assert.notEqual(terrainRenderSignature(state,1),key);
 state.map.blocked.push({column:3,row:4});
 assert.notEqual(terrainRenderSignature(state,0),key);
});

test('새 상태 객체의 턴·잔고·번역만 바뀌면 회전 고도 행렬을 재사용한다',()=>{
 const state=field();state.map.columns=8;state.map.rows=5;
 state.map.elevations=Array.from({length:5},()=>Array(8).fill(0));
 const first=prepareTerrain(state,1,null);
 const updated=structuredClone(state);updated.me={fp:25};updated.map.name='Translated';
 assert.equal(prepareTerrain(updated,1,first),first);
 assert.equal(prepareTerrain(updated,1,first).surface.elevations,first.surface.elevations);
 const rotated=prepareTerrain(updated,2,first);
 assert.notEqual(rotated,first);assert.equal(rotated.surface.columns,8);assert.equal(rotated.surface.rows,5);
 assert.equal(first.surface.columns,5);assert.equal(first.surface.rows,8);
 updated.map.elevations[0][0]=2;
 const raised=prepareTerrain(updated,1,first);
 assert.notEqual(raised,first);assert.equal(raised.surface.elevations[0][4],2);
 assert.equal(first.surface.elevations[0][4],0);
});
test('지형 연결·전장 전환은 이전 계획을 무효화한다',()=>{
 const state=field();let previous=prepareTerrain(state,0,null);
 for(const change of [
  ()=>state.map.ramps=[{id:'r',start:{column:0,row:0},end:{column:1,row:0}}],
  ()=>state.map.blocked=[{column:2,row:2}],
  ()=>state.battle={field:{columns:5,rows:7,cells:[],ramps:[]},blocked:[]},
 ]){
  change();const next=prepareTerrain(state,0,previous);assert.notEqual(next,previous);previous=next;
 }
 assert.equal(previous.surface.columns,5);assert.equal(previous.surface.rows,7);
});
