import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/fieldNavigation.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {fieldRoute,encounterRoute}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('같은 거리의 인접 칸은 위·왼쪽 순서를 유지하고 몬스터 칸을 통과하지 않는다',()=>{
 const map={columns:5,rows:5,blocked:[]},start={column:0,row:0},target={column:2,row:2};
 assert.deepEqual(encounterRoute(start,target,map),[{column:1,row:0},{column:2,row:0},{column:2,row:1}]);
 map.blocked=[{column:2,row:1}];
 assert.deepEqual(encounterRoute(start,target,map),[{column:1,row:0},{column:1,row:1},{column:1,row:2}]);
 map.blocked.push({column:1,row:2},{column:3,row:2},{column:2,row:3});
 assert.equal(encounterRoute(start,target,map),null);
});
test('대형 직사각형 맵에서 네 번 탐색과 경로는 같고 지형 조회는 절반 미만이다',()=>{
 let reads=0;
 const elevations=new Proxy(Array.from({length:80},()=>Array(100).fill(0)),{
  get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}
 });
 const map={columns:100,rows:80,blocked:[],elevations};
 const start={column:0,row:0},target={column:90,row:70};
 const oldRoutes=[[0,-1],[-1,0],[1,0],[0,1]].map(([dc,dr])=>
  fieldRoute(start,{column:target.column+dc,row:target.row+dr},{...map,blocked:[target]}))
  .filter(Boolean).sort((a,b)=>a.length-b.length);
 const repeatedReads=reads;reads=0;
 assert.deepEqual(encounterRoute(start,target,map),oldRoutes[0]);
 assert.ok(reads<repeatedReads/2,`${reads} / ${repeatedReads}`);
});
