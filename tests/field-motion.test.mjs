import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/fieldMotion.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {FieldMotion}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const actor=(column,x,id='slime')=>({id,cell:{column,row:2},point:{x,y:x/2,depth:column*10}});

test('서버 인접 이동은 위치를 보간하고 출발·도착 바닥보다 앞에 그린다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);
 motion.sync('field',[actor(3,164)],10);
 assert.deepEqual(motion.offset('slime',10),{x:-64,y:-32,depth:0});
 assert.deepEqual(motion.offset('slime',385),{x:0,y:0,depth:0});
 assert.deepEqual(motion.offset('slime',760),{x:0,y:0,depth:0});
});
test('중복 상태와 선택 화면 재조회는 이동을 다시 시작하지 않는다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);motion.sync('field',[actor(3,164)],10);
 motion.sync('field',[actor(3,164)],385);
 assert.equal(motion.movementElapsedMilliseconds('slime',385),375);
 assert.equal(motion.movementElapsedMilliseconds('slime',760),undefined);
 assert.equal(motion.offset('slime',760).x,0);
});
test('연속 확정 이동은 각 칸의 0.75초를 보존하고 서버 좌표는 변경하지 않는다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);motion.sync('field',[actor(3,164)],10);
 const next=actor(4,228),original=structuredClone(next);
 motion.sync('field',[next],385);
 assert.equal(motion.offset('slime',385).x+next.point.x,164);
 assert.deepEqual(next,original);
 assert.equal(motion.offset('slime',760).x+next.point.x,164);
 assert.equal(motion.isMovementActive('slime',1509),true);
 assert.equal(motion.isMovementActive('slime',1510),false);
 assert.equal(motion.offset('slime',1510).x,0);
 const subsequentActorRecord=actor(5,292);
 motion.sync('field',[subsequentActorRecord],5010);
 assert.equal(motion.isMovementActive('slime',5759),true);
 assert.equal(motion.isMovementActive('slime',5760),false);
});
test('공간/회전/세대 변경·원거리 보정·사라진 개체 재등장은 즉시 배치한다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);motion.sync('field',[actor(5,292)],10);
 assert.equal(motion.offset('slime',10).x,0);
 motion.sync('field:rotated',[actor(6,356)],20);assert.equal(motion.offset('slime',20).x,0);
 motion.sync('field:rotated',[],30);motion.sync('field:rotated',[actor(7,420)],40);
 assert.equal(motion.offset('slime',40).x,0);
 motion.clear();assert.equal(motion.offset('slime',40).x,0);
});

test('걷기 상태는 인접 이동 중에만 켜지고 완료·순간 배치 시 꺼진다',()=>{
 const fieldMotionTracker=new FieldMotion();
 fieldMotionTracker.sync('field',[actor(2,100)],0);
 assert.equal(fieldMotionTracker.isMovementActive('slime',0),false);
 fieldMotionTracker.sync('field',[actor(3,164)],10);
 assert.equal(fieldMotionTracker.isMovementActive('slime',759),true);
 assert.equal(fieldMotionTracker.isMovementActive('slime',760),false);
 fieldMotionTracker.sync('field',[actor(6,356)],200);
 assert.equal(fieldMotionTracker.isMovementActive('slime',200),false);
});

test('도착점을 조금 넘은 몸체·그림자는 복귀하고 깊이는 바닥 위에 유지한다',()=>{
 const currentMotionTracker=new FieldMotion();
 currentMotionTracker.sync('field',[actor(2,100)],0);
 currentMotionTracker.sync('field',[actor(3,164)],10);
 const currentMotionOffset=currentMotionTracker.offset('slime',(10+750*2/3));
 assert.ok(currentMotionOffset.x>0 && currentMotionOffset.x<64*.04);
 assert.ok(Math.abs(currentMotionOffset.y-currentMotionOffset.x/2)<1e-10);
 assert.equal(currentMotionOffset.depth,0);
 assert.ok(currentMotionTracker.offset('slime',680).x<currentMotionOffset.x);
 assert.deepEqual(currentMotionTracker.offset('slime',760),{x:0,y:0,depth:0});
});


test('필드의 서버 방향은 현재 재생 구간을 따르며 다음 도착 방향을 미리 표시하지 않는다',()=>{
 const currentMotionTracker=new FieldMotion();
 currentMotionTracker.sync('field',[actor(2,100)],0);
 currentMotionTracker.sync('field',[{...actor(3,164),serverWorldFacing:'column_positive'}],10);
 currentMotionTracker.sync('field',[{...actor(4,228),serverWorldFacing:'row_negative'}],260);
 assert.equal(currentMotionTracker.currentWorldFacing('slime',759),'column_positive');
 assert.equal(currentMotionTracker.currentWorldFacing('slime',760),'row_negative');
 assert.equal(currentMotionTracker.currentWorldFacing('slime',1510),undefined);
 currentMotionTracker.sync('field',[actor(5,292)],4010);
 assert.equal(currentMotionTracker.currentWorldFacing('slime',4100),undefined);
 assert.throws(()=>currentMotionTracker.sync('field',[{...actor(6,356),serverWorldFacing:'invalid'}],4200),/방향/);
});


test('양방향 이동의 모든 걷기 프레임에서 겹친 바닥에 가려지지 않고 완료 시 깊이를 복원한다',()=>{
 for(const [currentStartColumn,currentEndColumn] of [[2,3],[3,2]]){
  const currentMotionTracker=new FieldMotion();
  const currentStartActor=actor(currentStartColumn,currentStartColumn*64);
  const currentEndActor=actor(currentEndColumn,currentEndColumn*64);
  currentMotionTracker.sync('field',[currentStartActor],0);
  currentMotionTracker.sync('field',[currentEndActor],10);
  for(let currentFrameIndex=0;currentFrameIndex<6;currentFrameIndex++){
   const currentRenderedDepth=currentEndActor.point.depth+currentMotionTracker.offset('slime',10+currentFrameIndex*125).depth;
   assert.equal(currentRenderedDepth,Math.max(currentStartActor.point.depth,currentEndActor.point.depth));
  }
  assert.equal(currentMotionTracker.offset('slime',760).depth,0);
 }
});
