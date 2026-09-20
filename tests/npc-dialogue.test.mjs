import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentCompiledBundle=await build({entryPoints:['src/client/npcDialogue.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseNpcDialogue}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
const currentDialogueFixture={serverTime:30,characterVersion:2,npc:{id:'npc',name:'모라',cityId:'iseulon',facilityId:'iseulon-market'},acceptedCount:0,maximumAcceptedCount:5,
 entries:[{eventId:'first',title:'첫 납품',status:'AVAILABLE',dialogue:'재료를 부탁합니다.',items:[{itemId:'protein-jelly',required:2,owned:3,nameTranslations:{ko:'단백질젤리',en:'Protein jelly'}}],moneyP:4,action:'accept',canExecute:true,blockedReasons:[],giverNpcId:'npc',receiverNpcId:'npc'}]};
test('NPC 대화의 수령·전달·완료 계약을 검증한다',()=>{
 assert.deepEqual(parseNpcDialogue(currentDialogueFixture),currentDialogueFixture);
 for(const currentStatusName of ['ACCEPTED','COMPLETED','LOCKED']){
  const currentStateFixture=structuredClone(currentDialogueFixture);
  Object.assign(currentStateFixture.entries[0],{status:currentStatusName,action:currentStatusName==='COMPLETED'?null:currentStatusName==='ACCEPTED'?'complete':'accept',
   canExecute:currentStatusName==='ACCEPTED',blockedReasons:currentStatusName==='LOCKED'?['CITIZENSHIP_REQUIRED']:[]});
  assert.equal(parseNpcDialogue(currentStateFixture).entries[0].status,currentStatusName);
 }
});
test('알 수 없는 조건·중복 항목·실행 가능 불일치·잘못된 재료는 거절한다',()=>{
 for(const mutateDialogueFixture of [
  currentFixture=>currentFixture.entries[0].blockedReasons.push('UNKNOWN'),
  currentFixture=>currentFixture.entries[0].canExecute=false,
  currentFixture=>currentFixture.entries[0].action='cancel',
  currentFixture=>currentFixture.entries.push(structuredClone(currentFixture.entries[0])),
  currentFixture=>currentFixture.entries[0].items[0].owned=-1,
  currentFixture=>currentFixture.entries[0].moneyP=true,
  currentFixture=>currentFixture.maximumAcceptedCount=0,
  currentFixture=>currentFixture.npc.expiresAt=42,
 ]){const currentInvalidFixture=structuredClone(currentDialogueFixture);mutateDialogueFixture(currentInvalidFixture);assert.throws(()=>parseNpcDialogue(currentInvalidFixture));}
});
