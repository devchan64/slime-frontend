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
 assert.deepEqual(m.offset('hero',10),{x:-10,y:-10,depth:-1});
 assert.deepEqual(m.offset('hero',760),{x:0,y:-10,depth:0});
 m.sync('a',state(end,[move]),point,770);
 assert.equal(m.movementElapsedMilliseconds('hero',770),760);
 assert.equal(m.movementElapsedMilliseconds('hero',1510),undefined);
 assert.deepEqual(m.offset('hero',1510),{x:0,y:0,depth:0});
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
 assert.deepEqual(m.offset('hero',760),{x:0,y:-10,depth:0});
 assert.deepEqual(m.offset('hero',1510),{x:0,y:0,depth:0});
});

test('서버 구간 방향은 위치 보간과 같은 경계에서 전환하고 완료 후 해제한다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 const directedMoveRecord={...move,pathFacings:['column_positive','row_positive']};
 battleMotionTracker.sync('a',state(end,[directedMoveRecord]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',759),'column_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',760),'row_positive');
 battleMotionTracker.sync('a',state(end,[directedMoveRecord]),point,770);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',1509),'row_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',1510),undefined);
});
test('연속 경로의 방향을 이어 붙이고 구버전 무방향 로그는 방향을 추측하지 않는다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 battleMotionTracker.sync('a',state(end,[{...move,path:[corner],pathFacings:['column_positive']},{...move,path:[end],pathFacings:['row_positive']}]),point,10);
 assert.equal(battleMotionTracker.currentWorldFacing('hero',10),'column_positive');
 assert.equal(battleMotionTracker.currentWorldFacing('hero',760),'row_positive');
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
 assert.equal(battleMotionTracker.isMovementActive('hero',1019),true);
 assert.equal(battleMotionTracker.isMovementActive('hero',1520),false);
});

test('각 타일 구간은 약한 탄성 후 끝에서 정확히 도착한다',()=>{
 const battleMotionTracker=new BattleMotion();
 battleMotionTracker.sync('a',state(start),point,0);
 battleMotionTracker.sync('a',state(end,[move]),point,10);
 assert.deepEqual(battleMotionTracker.offset('hero',385),{x:0,y:-10,depth:-1});
 assert.deepEqual(battleMotionTracker.offset('hero',1135),{x:0,y:0,depth:0});
 const currentOvershootOffset=battleMotionTracker.offset('hero',(10+750*5/3));
 assert.ok(currentOvershootOffset.y>0 && currentOvershootOffset.y<.4);
 assert.equal(battleMotionTracker.isMovementActive('hero',1509),true);
 assert.equal(battleMotionTracker.isMovementActive('hero',1510),false);
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


test('이동 도중 받은 다음 경로는 현재 칸의 위치·방향·0.75초 종료 시각을 유지한다',()=>{
 const currentMotionTracker=new BattleMotion();
 const firstMovementRecord={...move,path:[corner],pathFacings:['column_positive']};
 const secondMovementRecord={...move,path:[end],pathFacings:['row_positive']};
 currentMotionTracker.sync('queued',state(start),point,0);
 currentMotionTracker.sync('queued',state(corner,[firstMovementRecord]),point,10);
 const previousMovementOffset=currentMotionTracker.offset('hero',260);
 currentMotionTracker.sync('queued',state(end,[firstMovementRecord,secondMovementRecord]),point,260);
 const appendedMovementOffset=currentMotionTracker.offset('hero',260);
 for(const currentCoordinateName of ['x','y','depth'])
   assert.ok(Math.abs(point(corner)[currentCoordinateName]+previousMovementOffset[currentCoordinateName]-point(end)[currentCoordinateName]-appendedMovementOffset[currentCoordinateName])<1e-12);
 assert.equal(currentMotionTracker.currentWorldFacing('hero',759),'column_positive');
 assert.equal(currentMotionTracker.currentWorldFacing('hero',760),'row_positive');
 assert.deepEqual(currentMotionTracker.offset('hero',760),{x:0,y:-10,depth:0});
 assert.equal(currentMotionTracker.isMovementActive('hero',1509),true);
 assert.equal(currentMotionTracker.isMovementActive('hero',1510),false);
 assert.deepEqual(currentMotionTracker.offset('hero',1510),{x:0,y:0,depth:0});
 const thirdMovementRecord={...move,path:[corner],pathFacings:['row_negative']};
 currentMotionTracker.sync('queued',state(corner,[firstMovementRecord,secondMovementRecord,thirdMovementRecord]),point,5010);
 assert.equal(currentMotionTracker.isMovementActive('hero',5759),true);
 assert.equal(currentMotionTracker.isMovementActive('hero',5760),false);
});


test('전투 이동의 12프레임 동안 출발·도착 바닥보다 앞에 그리고 두 칸 뒤 종료한다',()=>{
 for(const currentDirectionSign of [1,-1]){
  const currentMotionTracker=new BattleMotion();
  const currentStartPosition={column:currentDirectionSign>0?0:2,row:0};
  const currentMiddlePosition={column:1,row:0};
  const currentEndPosition={column:currentDirectionSign>0?2:0,row:0};
  const currentProjectPosition=currentPosition=>({x:currentPosition.column*100,y:0,depth:currentPosition.column*100});
  currentMotionTracker.sync('depth',state(currentStartPosition),currentProjectPosition,0);
  currentMotionTracker.sync('depth',state(currentEndPosition,[{...move,path:[currentMiddlePosition,currentEndPosition]}]),currentProjectPosition,10);
  for(let currentFrameIndex=0;currentFrameIndex<12;currentFrameIndex++){
   const currentMovementOffset=currentMotionTracker.offset('hero',10+currentFrameIndex*125);
   const currentSegmentStart=currentFrameIndex<6?currentStartPosition:currentMiddlePosition;
   const currentSegmentEnd=currentFrameIndex<6?currentMiddlePosition:currentEndPosition;
   assert.equal(currentProjectPosition(currentEndPosition).depth+currentMovementOffset.depth,
    Math.max(currentProjectPosition(currentSegmentStart).depth,currentProjectPosition(currentSegmentEnd).depth));
  }
  assert.equal(currentMotionTracker.isMovementActive('hero',1510),false);
  assert.deepEqual(currentMotionTracker.offset('hero',1510),{x:0,y:0,depth:0});
 }
});

test('전투 경로 추가로 완료 구간을 정리해도 걷기 프레임은 이어진다',()=>{
 const currentMotionTracker=new BattleMotion();
 currentMotionTracker.sync('phase',state(start),point,0);
 currentMotionTracker.sync('phase',state(end,[move]),point,10);
 const currentPreviousOffset=currentMotionTracker.offset('hero',1010);
 const currentNextMove={...move,path:[corner]};
 currentMotionTracker.sync('phase',state(corner,[move,currentNextMove]),point,1010);
 assert.equal(currentMotionTracker.movementElapsedMilliseconds('hero',1010),1000);
 assert.equal(currentMotionTracker.offset('hero',1010).y+point(corner).y,currentPreviousOffset.y+point(end).y);
 assert.equal(currentMotionTracker.isMovementActive('hero',2260),false);
 currentMotionTracker.sync('phase',state(end,[move,currentNextMove,{...move,path:[end]}]),point,3000);
 assert.equal(currentMotionTracker.movementElapsedMilliseconds('hero',3000),0);
});
