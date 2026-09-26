import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const idleActionBundle = await build({entryPoints:['src/game/animation/fieldIdleAction.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {FieldIdleAction} = await import(`data:text/javascript;base64,${Buffer.from(idleActionBundle.outputFiles[0].text).toString('base64')}`);
test('15초 무조작 후 한 번 재생하고 종료부터 다시 15초 기다린다',()=>{
 const idleActionState = new FieldIdleAction();idleActionState.resetIdleAction(100);
 assert.equal(idleActionState.sampleIdleAction(15099,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(15100,2000,true),0);
 assert.equal(idleActionState.sampleIdleAction(17099,2000,true),1999);
 assert.equal(idleActionState.sampleIdleAction(17100,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(32099,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(32100,2000,true),0);
});
test('입력은 재생을 중단하고 이동·전투 등 비활성 상태에서는 누적하지 않는다',()=>{
 const idleActionState = new FieldIdleAction();idleActionState.resetIdleAction(0);
 assert.equal(idleActionState.sampleIdleAction(15000,2000,true),0);
 idleActionState.resetIdleAction(15500);
 assert.equal(idleActionState.sampleIdleAction(30499,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(30500,2000,true),0);
 assert.equal(idleActionState.sampleIdleAction(30600,2000,false),null);
 assert.equal(idleActionState.sampleIdleAction(90000,2000,false),null);
 assert.equal(idleActionState.sampleIdleAction(104999,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(105000,2000,true),0);
});
test('긴 프레임 지연 후에도 연속 동작을 몰아서 실행하지 않는다',()=>{
 const idleActionState = new FieldIdleAction();idleActionState.resetIdleAction(0);
 idleActionState.sampleIdleAction(15000,2000,true);
 assert.equal(idleActionState.sampleIdleAction(100000,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(114999,2000,true),null);
 assert.equal(idleActionState.sampleIdleAction(115000,2000,true),0);
});
