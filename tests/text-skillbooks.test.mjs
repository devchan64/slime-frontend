import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createSkillCardClient(currentResponseFactory){
 const currentRequestRecords=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  const currentRequestRecord={path:new URL(currentRequestUrl).pathname,method:currentRequestOptions.method,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):null};
  currentRequestRecords.push(currentRequestRecord);
  const currentResponseValue=await currentResponseFactory(currentRequestRecord,currentRequestRecords);
  return currentResponseValue instanceof Response?currentResponseValue:new Response(JSON.stringify(currentResponseValue));
 }});
 currentTextClient.tokens={user_id:'hero',access_token:'test'};
 currentTextClient.state={protocolVersion:1,generation:1,epoch:1,cursor:1,me:{id:'hero',version:2,mode:'FIELD',position:{column:1,row:1}},location:{id:'city'},map:{id:'iseulon'},battle:null,reservation:null};
 return {currentTextClient,currentRequestRecords};
}
test('스킬카드는 조회한 조건으로 구매·소비하며 유실된 사용 응답을 같은 ID로 복구한다',async()=>{
 const currentCardDefinition={cardId:'monster-dissection-card',definitionVersion:1,priceP:100,literacyRequired:1,grantsSkill:'monster_dissection',nameTranslations:{ko:'몬스터 해부 스킬카드',en:'Monster Dissection Skill Card'},learned:false};
 let currentStoredCard=null;
 let currentUseAttempts=0;
 const {currentTextClient,currentRequestRecords}=createSkillCardClient(currentRequestRecord=>{
  if(currentRequestRecord.method==='GET')return {characterVersion:currentTextClient.state.me.version,cards:currentStoredCard?[currentStoredCard]:[],
   ...(currentRequestRecord.path.includes('bookshops')?{catalog:[{...currentCardDefinition,owned:!!currentStoredCard}]}:{})};
  const currentIsPurchase=currentRequestRecord.path.endsWith('/skill-card-purchases');
  const currentReturnedState=structuredClone(currentTextClient.state);currentReturnedState.me.version++;currentReturnedState.cursor++;
  if(currentIsPurchase)currentStoredCard={...currentCardDefinition,storage:'ACCOUNT',expiresAt:null,currentLiteracy:1,acquiredAt:100,source:'purchase'};
  else{currentUseAttempts++;if(currentUseAttempts===1)throw new TypeError('응답 유실');currentStoredCard=null;currentReturnedState.me.skills={monster_dissection:0};}
  return {state:currentReturnedState,receipt:{requestId:currentRequestRecord.body.requestId,completedAt:100,
   command:currentIsPurchase?{kind:'purchase',cardId:currentCardDefinition.cardId,facilityId:'iseulon-bookshop',definitionVersion:1,priceP:100}:{kind:'use',cardId:currentCardDefinition.cardId},
   result:currentIsPurchase?{cardId:currentCardDefinition.cardId,priceP:100,storage:'ACCOUNT',expiresAt:null}:{cardId:currentCardDefinition.cardId,skillId:'monster_dissection',level:0}}};
 });
 await assert.rejects(currentTextClient.execute('cards buy monster-dissection-card'),/먼저 확인/);
 await currentTextClient.execute('cards shop iseulon-bookshop');
 assert.match(await currentTextClient.execute('cards buy monster-dissection-card'),/계정 보관함 지급/);
 await assert.rejects(currentTextClient.execute('cards use monster-dissection-card'),/먼저 확인/);
 assert.match(await currentTextClient.execute('cards list'),/사용 시 소모/);
 assert.match(await currentTextClient.execute('cards use monster-dissection-card'),/소모 완료/);
 assert.deepEqual(currentRequestRecords.at(-1),currentRequestRecords.at(-2));
 assert.ok(currentRequestRecords.at(-1).body.requestId);
 assert.equal(currentTextClient.state.me.skills.monster_dissection,0);
 assert.equal(currentTextClient.pendingCommandRequest,null);
});

test('카드 견적은 계정·세대·위치가 바뀌면 사용할 수 없고 폐기된 책 명령은 요청하지 않는다',async()=>{
 const currentCardDefinition={cardId:'monster-dissection-card',definitionVersion:1,priceP:100,literacyRequired:1,grantsSkill:'monster_dissection',nameTranslations:{ko:'몬스터 해부 카드',en:'Monster Dissection Card'},learned:false,owned:false};
 for(const currentMutateContext of [currentTextClient=>currentTextClient.state.me.version++,currentTextClient=>currentTextClient.state.me.position.column++,
  currentTextClient=>currentTextClient.state.generation++,currentTextClient=>{currentTextClient.tokens.user_id='other';}]){
  const {currentTextClient,currentRequestRecords}=createSkillCardClient(()=>({characterVersion:2,cards:[],catalog:[currentCardDefinition]}));
  await assert.rejects(currentTextClient.execute('books buy monster-lore-book'),/스킬북 기능은 종료/);
  assert.equal(currentRequestRecords.length,0);
  await currentTextClient.execute('cards shop iseulon-bookshop');currentMutateContext(currentTextClient);
  await assert.rejects(currentTextClient.execute('cards buy monster-dissection-card'),/먼저 확인/);
  assert.equal(currentRequestRecords.length,1);
 }
});

test('잘못된 카드 구매 응답은 상태 적용 없이 같은 요청을 재시도 대상으로 보존한다',async()=>{
 const currentCardDefinition={cardId:'monster-dissection-card',definitionVersion:1,priceP:100,literacyRequired:1,grantsSkill:'monster_dissection',nameTranslations:{ko:'몬스터 해부 카드',en:'Monster Dissection Card'},learned:false,owned:false};
 const {currentTextClient,currentRequestRecords}=createSkillCardClient(currentRequestRecord=>currentRequestRecord.method==='GET'?{characterVersion:2,cards:[],catalog:[currentCardDefinition]}:
  {state:{...currentTextClient.state,me:{...currentTextClient.state.me,id:'other'}},receipt:{requestId:currentRequestRecord.body.requestId}});
 const currentBeforeState=structuredClone(currentTextClient.state);
 await currentTextClient.execute('cards shop iseulon-bookshop');
 await assert.rejects(currentTextClient.execute('cards buy monster-dissection-card'),/retry/);
 assert.deepEqual(currentTextClient.state,currentBeforeState);
 assert.ok(currentTextClient.pendingCommandRequest);
 assert.deepEqual(currentRequestRecords[1],currentRequestRecords[2]);
});
