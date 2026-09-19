import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/encounterNavigation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {approachMonster}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function setup() {
 const state={me:{mode:'FIELD',position:{column:0,row:1}},map:{columns:6,rows:4,blocked:[]},location:{id:'meadow'},generation:1,monsters:[{id:'slime',state:'AVAILABLE',position:{column:4,row:1}}]};
 const events=[];
 const controls={state:()=>state,stopped:()=>false,move:async p=>{events.push(['move',p]);state.me.position=p;},reserve:async id=>events.push(['reserve',id]),progress:()=>{},pause:async()=>{}};
 return {state,events,controls};
}
test('접근 중 FP가 소진되면 다음 칸과 조우를 요청하지 않는다',async()=>{
 const {state,events,controls}=setup();state.me.fp=1;
 const move=controls.move;controls.move=async p=>{await move(p);state.me.fp-=1;};
 await assert.rejects(approachMonster('slime',controls),/FP가 부족/);
 assert.deepEqual(events.map(e=>e[0]),['move']);
});
test('음수 FP는 조우를 막지만 0 FP에서 인접 조우는 가능하다',async()=>{
 const {state,events,controls}=setup();state.me.position={column:3,row:1};state.me.fp=-1;
 await assert.rejects(approachMonster('slime',controls),/FP가 음수/);
 assert.deepEqual(events,[]);
 state.me.fp=0;await approachMonster('slime',controls);
 assert.deepEqual(events,[['reserve','slime']]);
});
test('원거리 몬스터 인접 위치에 도착한 후 한 번만 조우 요청',async()=>{
 const {state,events,controls}=setup();await approachMonster('slime',controls);
 assert.deepEqual(state.me.position,{column:3,row:1});
 assert.deepEqual(events.map(e=>e[0]),['move','move','move','reserve']);
});
test('이동 중인 대상은 최신 위치로 접근 경로 갱신',async()=>{
 const {state,events,controls}=setup();controls.pause=async()=>{state.monsters[0].position={column:4,row:2};};
 await approachMonster('slime',controls);
 assert.equal(Math.abs(state.me.position.column-4)+Math.abs(state.me.position.row-2),1);
 assert.equal(events.at(-1)[0],'reserve');
});
test('중지·맵 변경·예약된 대상은 자동 조우하지 않음',async()=>{
 for(const reason of ['stop','map','target']) {
  const {state,events,controls}=setup();let stop=false;controls.stopped=()=>stop;
  controls.pause=async()=>{if(reason==='stop')stop=true;else if(reason==='map')state.location.id='grove';else state.monsters[0].state='RESERVED';};
  if(reason==='target')await assert.rejects(approachMonster('slime',controls),/더 이상 조우/);
  else await approachMonster('slime',controls);
  assert.equal(events.length,1);assert.equal(events[0][0],'move');
 }
});
