import {readFileSync} from 'node:fs';
import {parsePack} from '../src/i18n/catalog.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:"export * from './src/ui/encounterNavigation'; export * from './src/client/notice';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {approachMonster,noticeText}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function setup() {
 const state={me:{id:'hero',mode:'FIELD',position:{column:0,row:1}},map:{columns:6,rows:4,blocked:[]},location:{id:'meadow'},generation:1,epoch:1,monsters:[{id:'slime',state:'AVAILABLE',position:{column:4,row:1}}]};
 const events=[];
 const controls={state:()=>state,stopped:()=>false,move:async p=>{events.push(['move',p]);state.me.position=p;},reserve:async id=>events.push(['reserve',id]),progress:()=>{},pause:async()=>{}};
 return {state,events,controls};
}
test('접근 중 FP가 소진되면 다음 칸과 조우를 요청하지 않는다',async()=>{
 const {state,events,controls}=setup();state.me.fp=1;
 const move=controls.move;controls.move=async p=>{await move(p);state.me.fp-=1;};
 await assert.rejects(approachMonster('slime',controls),{name:'LocalizedError',key:'field.insufficientFp'});
 assert.deepEqual(events.map(e=>e[0]),['move']);
});
test('음수 FP는 조우를 막지만 0 FP에서 인접 조우는 가능하다',async()=>{
 const {state,events,controls}=setup();state.me.position={column:3,row:1};state.me.fp=-1;
 await assert.rejects(approachMonster('slime',controls),{name:'LocalizedError',key:'field.approachFpDebt'});
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
  if(reason==='target')await assert.rejects(approachMonster('slime',controls),{name:'LocalizedError',key:'field.approachTargetLost'});
  else await approachMonster('slime',controls);
  assert.equal(events.length,1);assert.equal(events[0][0],'move');
 }
});

test('같은 맵으로 복귀해도 이전 공간·캐릭터의 접근 지시를 재개하지 않는다',async()=>{
 for(const changed of ['epoch','character','generation','interruption']) {
  const {state,events,controls}=setup();
  controls.pause=async()=>{
   if(changed==='epoch')state.epoch++;
   if(changed==='character')state.me.id='another-hero';
   if(changed==='generation')state.generation++;
   if(changed==='interruption')state.me.lastFieldInterruption={battleId:'new-aggro'};
  };
  await approachMonster('slime',controls);
  assert.deepEqual(events.map(e=>e[0]),['move'],changed);
 }
});

test('같은 공간의 정상 스냅샷 갱신은 접근을 중단하지 않는다',async()=>{
 const {state,events,controls}=setup();
 state.me.lastFieldInterruption={battleId:'past-battle'};
 controls.pause=async()=>{state.cursor=(state.cursor??0)+1;state.me.version=(state.me.version??0)+1;};
 await approachMonster('slime',controls);
 assert.deepEqual(events.map(e=>e[0]),['move','move','move','reserve']);
});

 test('저장된 접근 오류를 재실행 없이 언어팩으로 다시 표시한다',async()=>{
 const {state,events,controls}=setup();state.me.fp=-1;
 let error;try{await approachMonster('slime',controls);}catch(captured){error=captured;}
 const ko=parsePack(readFileSync('src/i18n/locales/ko/field.yaml','utf8'),'ko.field');
 const en=parsePack(readFileSync('src/i18n/locales/en/field.yaml','utf8'),'en.field');
 assert.equal(noticeText(error,'ko',key=>ko[key.slice(6)]),ko.approachFpDebt);
 assert.equal(noticeText(error,'en',key=>en[key.slice(6)]),en.approachFpDebt);
 assert.notEqual(ko.approachFpDebt,en.approachFpDebt);
 assert.deepEqual(events,[]);
});
