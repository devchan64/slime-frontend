import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createNpcState(){return {protocolVersion:1,generation:1,epoch:1,cursor:1,map:{id:'city',buildings:[{entrance:{column:1,row:2},npcs:[{id:'helper',name:'안내인'}]}]},location:{id:'channel'},me:{id:'hero',mode:'FIELD',version:1,position:{column:1,row:2}}};}
function createNpcDialogue(){return {serverTime:150,characterVersion:1,npc:{id:'helper',name:'안내인',cityId:'city',facilityId:'guild'},acceptedCount:0,maximumAcceptedCount:3,entries:[{eventId:'first-delivery',title:'첫 납품',status:'AVAILABLE',dialogue:'재료를 전달하세요.',items:[{itemId:'protein-jelly',required:2,owned:3,nameTranslations:{ko:'젤리',en:'Jelly'}}],moneyP:4,action:'accept',canExecute:true,blockedReasons:[],giverNpcId:'helper',receiverNpcId:'helper'}]};}
function setupNpcClient(currentResponseEntries){
 const currentRequestCalls=[];const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestCalls.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});assert.ok(currentResponseEntries.length);
  const currentResponseEntry=currentResponseEntries.shift();if(currentResponseEntry instanceof Error)throw currentResponseEntry;
  return new Response(JSON.stringify(currentResponseEntry));
 }});currentTextClient.accept(createNpcState());return {currentTextClient,currentRequestCalls};
}
test('NPC 발견·대화의 재료 보상 확인 후 명시적으로 수령·완료한다',async()=>{
 for(const currentActionName of ['accept','complete']){
  const currentDialoguePage=createNpcDialogue();
  if(currentActionName==='complete'){currentDialoguePage.entries[0].status='ACCEPTED';currentDialoguePage.entries[0].action='complete';currentDialoguePage.acceptedCount=1;}
  const {currentTextClient,currentRequestCalls}=setupNpcClient([currentDialoguePage,{state:createNpcState()}]);
  assert.match(await currentTextClient.execute('npc list'),/helper.*1,2/);
  const currentDialogueText=await currentTextClient.execute('npc talk helper');assert.match(currentDialogueText,/젤리: 3\/2/);assert.match(currentDialogueText,/보상 4p/);
  await currentTextClient.execute('quest '+currentActionName+' helper first-delivery');
  assert.deepEqual(currentRequestCalls[1].body,{npcId:'helper',expectedVersion:1});
  assert.ok(currentRequestCalls[1].url.endsWith('/first-delivery/'+currentActionName));
  await assert.rejects(currentTextClient.execute('quest '+currentActionName+' helper first-delivery'),/먼저/);
 }
});
test('실행 불가·다른 화자·상태 변경·미확인 의뢰는 전송하지 않는다',async()=>{
 for(const currentInvalidCase of ['blocked','npc','version','action']){
  const currentDialoguePage=createNpcDialogue();
  if(currentInvalidCase==='blocked'){currentDialoguePage.entries[0].status='LOCKED';currentDialoguePage.entries[0].blockedReasons=['CITIZENSHIP_REQUIRED'];currentDialoguePage.entries[0].canExecute=false;}
  const {currentTextClient,currentRequestCalls}=setupNpcClient([currentDialoguePage]);
  const currentDialogueText=await currentTextClient.execute('npc talk helper');
  if(currentInvalidCase==='blocked')assert.match(currentDialogueText,/시민권/);
  if(currentInvalidCase==='version')currentTextClient.state.me.version++;
  await assert.rejects(currentTextClient.execute('quest '+(currentInvalidCase==='action'?'complete':'accept')+' '+(currentInvalidCase==='npc'?'other':'helper')+' first-delivery'));
  assert.equal(currentRequestCalls.length,1);
 }
});
test('결과 불명 의뢰는 자동 재전송하지 않고 새 대화를 요구한다',async()=>{
 const {currentTextClient,currentRequestCalls}=setupNpcClient([createNpcDialogue(),new TypeError('network')]);
 await currentTextClient.execute('npc talk helper');
 await assert.rejects(currentTextClient.execute('quest accept helper first-delivery'),/network/);
 await assert.rejects(currentTextClient.execute('quest accept helper first-delivery'),/먼저/);
 assert.equal(currentRequestCalls.length,2);
});
test('대화 대상 불일치와 잘못된 입력을 거절한다',async()=>{
 const currentDialoguePage=createNpcDialogue();currentDialoguePage.npc.id='other';
 const {currentTextClient,currentRequestCalls}=setupNpcClient([currentDialoguePage]);
 await assert.rejects(currentTextClient.execute('npc talk helper'),/대화 대상/);
 for(const currentCommandText of ['npc','npc talk','quest accept helper','quest cancel helper first-delivery','npc talk ../wrong'])await assert.rejects(currentTextClient.execute(currentCommandText));
 assert.equal(currentRequestCalls.length,1);
});

test('상태 재조회에서 좌표 필드 순서만 바뀌어도 확인한 대화는 유효하다',async()=>{
 const currentReloadedState=createNpcState();currentReloadedState.me.position={row:2,column:1};
 const {currentTextClient,currentRequestCalls}=setupNpcClient([createNpcDialogue(),currentReloadedState,{state:createNpcState()}]);
 await currentTextClient.execute('npc talk helper');
 await currentTextClient.execute('state');
 await currentTextClient.execute('quest accept helper first-delivery');
 assert.equal(currentRequestCalls.length,3);
 assert.deepEqual(currentRequestCalls[2].body,{npcId:'helper',expectedVersion:1});
});
