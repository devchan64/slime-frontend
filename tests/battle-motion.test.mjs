import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/battleMotion.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {BattleMotion}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const point=p=>({x:p.column*10,y:p.row*10,depth:p.column+p.row});
const state=(position,log=[])=>({units:[{id:'hero',hp:10,position}],log});
const start={column:0,row:0},corner={column:1,row:0},end={column:1,row:1};
const move={unitId:'hero',action:'MOVE',path:[corner,end]};
test('확정 경로를 꺾이는 칸까지 순서대로 재생하고 중복 스냅샷은 재시작하지 않는다',()=>{
 const m=new BattleMotion();m.sync('a',state(start),point,0);
 m.sync('a',state(end,[move]),point,10);
 assert.deepEqual(m.offset('hero',10),{x:-10,y:-10,depth:-2});
 assert.deepEqual(m.offset('hero',190),{x:0,y:-10,depth:-1});
 m.sync('a',state(end,[move]),point,200);
 assert.deepEqual(m.offset('hero',370),{x:0,y:0,depth:0});
});
test('접속과 회전·전장 변경은 과거 경로를 재생하지 않는다',()=>{
 const m=new BattleMotion();m.sync('a',state(end,[move]),point,0);
 assert.equal(m.offset('hero',0).x,0);
 m.sync('b',state(end,[move]),point,20);
 assert.equal(m.offset('hero',20).y,0);
 m.sync('b',null,point,30);assert.equal(m.offset('hero',30).x,0);
});
test('한 스냅샷의 연속 이동은 앞 경로 뒤에 이어 붙인다',()=>{
 const m=new BattleMotion();m.sync('a',state(start),point,0);
 m.sync('a',state(end,[{...move,path:[corner]},{...move,path:[end]}]),point,10);
 assert.deepEqual(m.offset('hero',190),{x:0,y:-10,depth:-1});
 assert.deepEqual(m.offset('hero',370),{x:0,y:0,depth:0});
});
