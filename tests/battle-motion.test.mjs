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

test('서버 구간 방향은 위치 보간과 같은 경계에서 전환하고 완료 후 해제한다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 const directedMoveRecord={...move,pathFacings:['column_positive','row_positive']};
 battleMotionTracker.sync('a',state(end,[directedMoveRecord]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',189),'column_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',190),'row_positive');
 battleMotionTracker.sync('a',state(end,[directedMoveRecord]),point,200);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',369),'row_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',370),undefined);
});
test('연속 경로의 방향을 이어 붙이고 구버전 무방향 로그는 방향을 추측하지 않는다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 battleMotionTracker.sync('a',state(end,[{...move,path:[corner],pathFacings:['column_positive']},{...move,path:[end],pathFacings:['row_positive']}]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',10),'column_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',190),'row_positive');
 battleMotionTracker.sync('b',state(start),point,0);
 battleMotionTracker.sync('b',state(end,[move]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',10),undefined);
});
test('경로와 맞지 않는 방향 정보는 명시적으로 거절한다',()=>{
 for(const invalidPathFacings of [[],['column_positive'],['invalid','row_positive']]){
  const battleMotionTracker=new BattleMotion();battleMotionTracker.sync('a',state(start),point,0);
  assert.throws(()=>battleMotionTracker.sync('a',state(end,[{...move,pathFacings:invalidPathFacings}]),point,10),/방향/);
 }
});
