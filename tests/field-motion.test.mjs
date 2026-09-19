import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/fieldMotion.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {FieldMotion}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const actor=(column,x,id='slime')=>({id,cell:{column,row:2},point:{x,y:x/2,depth:column*10}});

test('서버 인접 이동의 몸체·발밑·높이·깊이는 같은 보간 비율을 사용한다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);
 motion.sync('field',[actor(3,164)],10);
 assert.deepEqual(motion.offset('slime',10),{x:-64,y:-32,depth:-10});
 assert.deepEqual(motion.offset('slime',100),{x:-32,y:-16,depth:-5});
 assert.deepEqual(motion.offset('slime',190),{x:0,y:0,depth:0});
});
test('중복 상태와 선택 화면 재조회는 이동을 다시 시작하지 않는다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);motion.sync('field',[actor(3,164)],10);
 motion.sync('field',[actor(3,164)],100);
 assert.equal(motion.offset('slime',190).x,0);
});
test('연속 확정 이동은 현재 화면 위치에서 이어지고 서버 좌표는 변경하지 않는다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);motion.sync('field',[actor(3,164)],10);
 const next=actor(4,228),original=structuredClone(next);
 motion.sync('field',[next],100);
 assert.equal(motion.offset('slime',100).x+next.point.x,132);
 assert.deepEqual(next,original);
 assert.equal(motion.offset('slime',280).x,0);
});
test('공간/회전/세대 변경·원거리 보정·사라진 개체 재등장은 즉시 배치한다',()=>{
 const motion=new FieldMotion();motion.sync('field',[actor(2,100)],0);motion.sync('field',[actor(5,292)],10);
 assert.equal(motion.offset('slime',10).x,0);
 motion.sync('field:rotated',[actor(6,356)],20);assert.equal(motion.offset('slime',20).x,0);
 motion.sync('field:rotated',[],30);motion.sync('field:rotated',[actor(7,420)],40);
 assert.equal(motion.offset('slime',40).x,0);
 motion.clear();assert.equal(motion.offset('slime',40).x,0);
});
