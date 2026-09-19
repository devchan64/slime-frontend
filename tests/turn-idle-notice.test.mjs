import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/turnIdleNotice.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {watchTurnIdle,TURN_IDLE_NOTICE_MS}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function setup(){
 const target=new EventTarget(), notices=[], timers=new Map();let id=0;
 const stop=watchTurnIdle(target,x=>notices.push(x),(fn,delay)=>{assert.equal(delay,5000);timers.set(++id,fn);return id;},id=>timers.delete(id));
 return {target,notices,timers,stop};
}
test('입력 전까지 5초 후 안내만 표시한다',()=>{
 const x=setup();assert.equal(TURN_IDLE_NOTICE_MS,5000);assert.deepEqual(x.notices,[false]);
 [...x.timers.values()][0]();assert.deepEqual(x.notices,[false,true]);x.stop();
});
test('포인터·키보드·입력이 안내를 닫고 대기 시간을 다시 시작한다',()=>{
 for(const event of ['pointerdown','keydown','input']){
  const x=setup();[...x.timers.values()][0]();const previous=[...x.timers.keys()][0];
  x.target.dispatchEvent(new Event(event));assert.equal(x.notices.at(-1),false);
  assert.equal(x.timers.size,1);assert.notEqual([...x.timers.keys()][0],previous);
  [...x.timers.values()][0]();assert.equal(x.notices.at(-1),true);x.stop();
 }
});
test('턴 전환·비활성화의 정리는 타이머와 입력 감시를 모두 제거한다',()=>{
 const x=setup(),late=[...x.timers.values()][0];x.stop();const before=[...x.notices];
 x.target.dispatchEvent(new Event('keydown'));late();assert.deepEqual(x.notices,before);assert.equal(x.timers.size,0);
});
