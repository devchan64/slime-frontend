import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/battleMotion.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {BattleMotion}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const point=p=>({x:p.column*10,y:p.row*10,depth:p.column+p.row});
const state=(position,log=[])=>({units:[{id:'hero',hp:10,position}],log});
const start={column:0,row:0},corner={column:1,row:0},end={column:1,row:1};
const move={unitId:'hero',action:'MOVE',path:[corner,end]};
const attack={unitId:'hero',action:'ATTACK',targetId:'enemy'};
test('확정 경로를 꺾이는 칸까지 순서대로 재생하고 중복 스냅샷은 재시작하지 않는다',()=>{
 const m=new BattleMotion();m.sync('a',state(start),point,0);
 m.sync('a',state(end,[move]),point,10);
 assert.deepEqual(m.offset('hero',10),{x:-10,y:-10,depth:-2});
 assert.deepEqual(m.offset('hero',1510),{x:0,y:-10,depth:-1});
 m.sync('a',state(end,[move]),point,1520);
 assert.deepEqual(m.offset('hero',3010),{x:0,y:0,depth:0});
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
 assert.deepEqual(m.offset('hero',1510),{x:0,y:-10,depth:-1});
 assert.deepEqual(m.offset('hero',3010),{x:0,y:0,depth:0});
});

test('서버 구간 방향은 위치 보간과 같은 경계에서 전환하고 완료 후 해제한다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 const directedMoveRecord={...move,pathFacings:['column_positive','row_positive']};
 battleMotionTracker.sync('a',state(end,[directedMoveRecord]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',1509),'column_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',1510),'row_positive');
 battleMotionTracker.sync('a',state(end,[directedMoveRecord]),point,1520);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',3009),'row_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',3010),undefined);
});
test('연속 경로의 방향을 이어 붙이고 구버전 무방향 로그는 방향을 추측하지 않는다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 battleMotionTracker.sync('a',state(end,[{...move,path:[corner],pathFacings:['column_positive']},{...move,path:[end],pathFacings:['row_positive']}]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',10),'column_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',1510),'row_positive');
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

test('일반 공격은 별도 애니메이션 없이 공격자 돌진과 대상 반동 전환만 재생한다',()=>{
 const battleMotionTracker=new BattleMotion();
 const initialBattle={units:[{id:'hero',hp:10,position:start},{id:'enemy',hp:10,position:{column:2,row:0}}],log:[]};
 const attackedBattle={...initialBattle,log:[attack]};
 const projectBattlePoint=p=>({x:p.column*10,y:p.row*10,depth:p.column+p.row});
 battleMotionTracker.sync('attack',initialBattle,projectBattlePoint,0);
 battleMotionTracker.sync('attack',attackedBattle,projectBattlePoint,10);
 assert.deepEqual(battleMotionTracker.offset('hero',145),{x:6.4,y:0,depth:0.64});
 assert.deepEqual(battleMotionTracker.offset('enemy',145),{x:-1.6,y:0,depth:-0.16});
 battleMotionTracker.sync('attack',attackedBattle,projectBattlePoint,150);
 assert.deepEqual(battleMotionTracker.offset('hero',310),{x:0,y:0,depth:0});
});

test('공격 돌진은 걷기로 처리하지 않고 이동 경로의 종료 경계에서 걷기를 해제한다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 battleMotionTracker.sync('a',state(start,[attack]),point,10);
 assert.equal(battleMotionTracker.isMovementActive('hero',10),false);
 battleMotionTracker.sync('a',state(end,[attack,move]),point,20);
 assert.equal(battleMotionTracker.isMovementActive('hero',2019),true);
 assert.equal(battleMotionTracker.isMovementActive('hero',3020),false);
});

test('각 타일 구간은 약한 탄성 후 끝에서 정확히 도착한다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 battleMotionTracker.sync('a',state(end,[move]),point,10);
 assert.deepEqual(battleMotionTracker.offset('hero',760),{x:0,y:-10,depth:-1});
 assert.deepEqual(battleMotionTracker.offset('hero',2260),{x:0,y:0,depth:0});
 const currentOvershootOffset=battleMotionTracker.offset('hero',(10+1500*5/3));
 assert.ok(currentOvershootOffset.y>0 && currentOvershootOffset.y<.4);
 assert.equal(battleMotionTracker.isMovementActive('hero',3009),true);
 assert.equal(battleMotionTracker.isMovementActive('hero',3010),false);
});

test('표시 HP 0의 생존 유닛은 이동을 이어가고 실제 전투불능 갱신에서만 멈춘다',()=>{
 const currentMotionTracker=new BattleMotion();
 const currentAliveBattle=state(start);
 currentAliveBattle.units[0]={...currentAliveBattle.units[0],hp:0,healthDepleted:false};
 currentMotionTracker.sync('fractional',currentAliveBattle,point,0);
 const currentMovingBattle={units:[{...currentAliveBattle.units[0],position:end}],log:[move]};
 currentMotionTracker.sync('fractional',currentMovingBattle,point,10);
 assert.equal(currentMotionTracker.isMovementActive('hero',100),true);
 assert.notDeepEqual(currentMotionTracker.offset('hero',100),{x:0,y:0,depth:0});
 currentMotionTracker.sync('fractional',currentMovingBattle,point,110);
 assert.equal(currentMotionTracker.isMovementActive('hero',120),true);
 const currentDefeatedBattle={...currentMovingBattle,units:[{...currentMovingBattle.units[0],healthDepleted:true}]};
 currentMotionTracker.sync('fractional',currentDefeatedBattle,point,130);
 assert.equal(currentMotionTracker.isMovementActive('hero',140),false);
 assert.deepEqual(currentMotionTracker.offset('hero',140),{x:0,y:0,depth:0});
});

test('공격 로그의 정수 HP 0은 생존 대상의 반동을 제거하지 않는다',()=>{
 const currentMotionTracker=new BattleMotion();
 const currentInitialBattle={units:[{id:'hero',hp:10,position:start},{id:'enemy',hp:1,position:corner}],log:[]};
 currentMotionTracker.sync('fractional-impact',currentInitialBattle,point,0);
 const currentImpactBattle={units:[currentInitialBattle.units[0],{...currentInitialBattle.units[1],hp:0,healthDepleted:false}],log:[{...attack,targetHp:0}]};
 currentMotionTracker.sync('fractional-impact',currentImpactBattle,point,10);
 assert.ok(currentMotionTracker.offset('enemy',145).x<0);
 currentMotionTracker.sync('fractional-impact',{...currentImpactBattle,units:[currentImpactBattle.units[0],{...currentImpactBattle.units[1],healthDepleted:true}]},point,150);
 assert.deepEqual(currentMotionTracker.offset('enemy',160),{x:0,y:0,depth:0});
});
