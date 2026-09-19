import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const moduleAt=async path=>{
 const {outputFiles}=await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
};
const {project,pickSurface,canStep,cliffFaces}=await moduleAt('src/game/terrain/elevation.ts');
const {fieldRoute,encounterRoute,fieldDistance}=await moduleAt('src/ui/fieldNavigation.ts');
const {buildMeadowRoad}=await moduleAt('src/game/terrain/meadow.ts');
const fixtures=JSON.parse(await readFile('src/dev/battlefield-fixtures.json','utf8'));
for(const state of fixtures)test(`${state.battle.field.name}: 지면 선택과 계단 경로`,()=>{
 const d=state.battle.field;
 for(const cell of d.cells){
   const p=project(cell,d),picked=pickSurface(p.x,p.y,d);
   // 지면 중심이 앞쪽 절벽에 가려질 수는 있지만 다른 뒤쪽 지면을 선택하면 안 된다.
   if(picked)assert.ok(picked.column+picked.row>=cell.column+cell.row);
 }
 for(const edge of d.ramps){assert.ok(canStep(edge.start,edge.end,d));assert.ok(canStep(edge.end,edge.start,d));}
 for(const move of state.battle.tactics.moves){
   let p=state.battle.units.find(u=>u.id===state.me.id).position;
   for(const q of move.path){assert.ok(canStep(p,q,d));p=q;}
 }
});
test('절벽 옆 칸으로 바로 건너가지 않고 명시적인 계단으로 우회한다',()=>{
 const map={columns:5,rows:5,blocked:[],elevations:Array.from({length:5},()=>[0,0,1,1,1]),ramps:[{start:{column:1,row:4},end:{column:2,row:4}}]};
 const start={column:1,row:1},end={column:2,row:1};
 assert.equal(canStep(start,end,map),false);
 const route=fieldRoute(start,end,map);assert.equal(route.length,7);
 let previous=start;for(const cell of route){assert.ok(canStep(previous,cell,map));previous=cell;}
 const top=project(end,map);assert.deepEqual(pickSurface(top.x,top.y,map),end);
 const front={column:4,row:4};const face=cliffFaces(front,map)[0];
 const center=face.reduce((s,p)=>({x:s.x+p.x/4,y:s.y+p.y/4}),{x:0,y:0});
 assert.equal(pickSurface(center.x,center.y,map),null);
});
test('필드 세 길은 높이가 다른 지면에서도 모든 목적지에 이어진다',()=>{
 const map=fixtures[0].map,road=buildMeadowRoad(map);
 for(const gate of map.connections){
   assert.ok(road.has(`${gate.column},${gate.row}`));
   assert.ok(fieldRoute(map.startPoint,gate,map));
 }
});
test('고도 없는 기존 평면 지면 선택과 이동을 유지한다',()=>{
 const d={columns:12,rows:10};const p={column:5,row:4};const s=project(p,d);
 assert.deepEqual(pickSurface(s.x,s.y,d),p);assert.ok(canStep(p,{column:6,row:4},d));
});

test('멀리 있는 몬스터의 칸을 통과하지 않고 가장 가까운 인접 칸으로 이동한다',()=>{
 const map={columns:6,rows:5,blocked:[]}; const target={column:4,row:2};
 const route=encounterRoute({column:0,row:2},target,map);
 assert.equal(route.length,3);
 assert.equal(fieldDistance(route.at(-1),target),1);
 assert.ok(route.every(p=>p.column!==target.column||p.row!==target.row));
 assert.deepEqual(encounterRoute({column:3,row:2},target,map),[]);
});
test('몬스터 접근 경로가 막혔거나 위치가 바뀌면 현재 위치로 다시 판단한다',()=>{
 const map={columns:5,rows:5,blocked:[{column:1,row:2},{column:3,row:2},{column:2,row:1},{column:2,row:3}]};
 assert.equal(encounterRoute({column:0,row:0},{column:2,row:2},map),null);
 const moved=encounterRoute({column:0,row:0},{column:4,row:0},map);
 assert.equal(fieldDistance(moved.at(-1),{column:4,row:0}),1);
});
