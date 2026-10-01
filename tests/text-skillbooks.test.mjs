import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const CURRENT_BOOK_DEFINITION={definitionId:'monster-lore-book',definitionVersion:3,priceP:100,literacyRequired:3,grantsSkill:'monster_lore',nameTranslations:{ko:'몬스터학\u001b 스킬북',en:'Monster lore'}};
const CURRENT_BOOK_OWNER_RECORD={...CURRENT_BOOK_DEFINITION,requestId:'owned-request',facilityId:'iseulon-bookshop',purchasedAt:100,firstReadAt:null,weightG:450};
function createSkillbookTextClient(currentResponseFactory){
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
function createBookshopCatalogResponse(){return {characterVersion:2,books:[],catalog:[{...CURRENT_BOOK_DEFINITION,owned:false}]};}
test('가격 확인 후 구매 응답 유실 시 같은 요청으로 복구한다',async()=>{
 let currentPurchaseCount=0;
 const {currentTextClient,currentRequestRecords}=createSkillbookTextClient(currentRequestRecord=>{
  if(currentRequestRecord.method==='GET')return createBookshopCatalogResponse();
  currentPurchaseCount++;
  if(currentPurchaseCount===1)throw new TypeError('응답 유실');
  return {book:{...CURRENT_BOOK_OWNER_RECORD,requestId:currentRequestRecord.body.requestId},state:{...currentTextClient.state,me:{...currentTextClient.state.me,version:3},cursor:2}};
 });
 await assert.rejects(currentTextClient.execute('books buy monster-lore-book'),/가격을 먼저/);
 assert.equal(currentRequestRecords.length,0);
 assert.match(await currentTextClient.execute('books shop iseulon-bookshop'),/100p/);
 assert.match(await currentTextClient.execute('books buy monster-lore-book'),/구매 완료.*100p/);
 assert.deepEqual(currentRequestRecords[1],currentRequestRecords[2]);
 assert.equal(currentRequestRecords[1].path,'/v1/game/bookshops/iseulon-bookshop/purchases');
 assert.equal(currentRequestRecords[1].body.priceP,100);
 assert.equal(currentTextClient.state.me.version,3);
 assert.equal(currentTextClient.pendingCommandRequest,null);
 assert.equal(currentTextClient.bookshopCatalogQuote,null);
});
test('상태·위치·세대·계정 변경 후 이전 가격으로 구매하지 않는다',async()=>{
 for(const currentMutateContext of [
  currentTextClient=>currentTextClient.state.me.version++,currentTextClient=>currentTextClient.state.me.position.column++,
  currentTextClient=>currentTextClient.state.generation++,currentTextClient=>{currentTextClient.tokens.user_id='other';},
 ]){
  const {currentTextClient,currentRequestRecords}=createSkillbookTextClient(()=>createBookshopCatalogResponse());
  await currentTextClient.execute('books shop iseulon-bookshop');currentMutateContext(currentTextClient);
  await assert.rejects(currentTextClient.execute('books buy monster-lore-book'),/가격을 먼저/);
  assert.equal(currentRequestRecords.length,1);
 }
});
test('열람은 expectedVersion만 보내며 응답 유실 뒤 동일 요청을 보낸다',async()=>{
 let currentReadAttempts=0;
 const {currentTextClient,currentRequestRecords}=createSkillbookTextClient(()=>{
  currentReadAttempts++;if(currentReadAttempts===1)throw new TypeError('응답 유실');
  return {book:{...CURRENT_BOOK_OWNER_RECORD,firstReadAt:101},state:{...currentTextClient.state,me:{...currentTextClient.state.me,version:3},cursor:2}};
 });
 assert.match(await currentTextClient.execute('books read monster-lore-book'),/열람 완료/);
 assert.deepEqual(currentRequestRecords.map(currentRequestRecord=>currentRequestRecord.body),[{expectedVersion:2},{expectedVersion:2}]);
 assert.equal(currentRequestRecords[0].path,'/v1/game/skillbooks/monster-lore-book/read');
});
test('가격 변경 거절은 자동 재구매하지 않고 새 견적을 요구한다',async()=>{
 const {currentTextClient,currentRequestRecords}=createSkillbookTextClient(currentRequestRecord=>currentRequestRecord.method==='GET'?createBookshopCatalogResponse():
  new Response(JSON.stringify({code:'STATE_CHANGED',message:'가격 변경'}),{status:409}));
 await currentTextClient.execute('books shop iseulon-bookshop');
 await assert.rejects(currentTextClient.execute('books buy monster-lore-book'),{code:'STATE_CHANGED'});
 assert.equal(currentRequestRecords.length,2);
 assert.equal(currentTextClient.pendingCommandRequest,null);
 await assert.rejects(currentTextClient.execute('books buy monster-lore-book'),/가격을 먼저/);
});
test('다른 책·결제금액·요청·캐릭터의 구매 응답은 상태를 적용하지 않는다',async()=>{
 for(const currentCorruptResponse of [
  currentResponseValue=>{currentResponseValue.book.definitionId='wrong-book';},
  currentResponseValue=>{currentResponseValue.book.priceP=999;},
  currentResponseValue=>{currentResponseValue.book.requestId='wrong';},
  currentResponseValue=>{currentResponseValue.state.me.id='other';},
 ]){
  const {currentTextClient,currentRequestRecords}=createSkillbookTextClient(currentRequestRecord=>{
   if(currentRequestRecord.method==='GET')return createBookshopCatalogResponse();
   const currentResponseValue={book:{...structuredClone(CURRENT_BOOK_OWNER_RECORD),requestId:currentRequestRecord.body.requestId},state:structuredClone(currentTextClient.state)};
   currentCorruptResponse(currentResponseValue);return currentResponseValue;
  });
  const currentBeforeState=structuredClone(currentTextClient.state);
  await currentTextClient.execute('books shop iseulon-bookshop');
  await assert.rejects(currentTextClient.execute('books buy monster-lore-book'),/retry/);
  assert.deepEqual(currentTextClient.state,currentBeforeState);
  assert.ok(currentTextClient.pendingCommandRequest);
  assert.deepEqual(currentRequestRecords[1],currentRequestRecords[2]);
 }
});
test('개인 목록은 복구 대기 중 읽기만 수행하고 제어문자를 제거한다',async()=>{
 const {currentTextClient,currentRequestRecords}=createSkillbookTextClient(()=>({characterVersion:2,books:[CURRENT_BOOK_OWNER_RECORD]}));
 currentTextClient.pendingCommandRequest={path:'pending'};
 const currentOriginalState=structuredClone(currentTextClient.state);
 const currentBookOutput=await currentTextClient.execute('books list');
 assert.match(currentBookOutput,/미열람/);assert.doesNotMatch(currentBookOutput,/\u001b/);
 assert.deepEqual(currentTextClient.state,currentOriginalState);
 await assert.rejects(currentTextClient.execute('books read monster-lore-book'),/retry/);
 assert.equal(currentRequestRecords.length,1);
});
test('늦은 서점 응답·누락 카탈로그·불일치 버전은 구매 견적으로 저장하지 않는다',async()=>{
 for(const currentResponseMode of ['late','missing','version']){
  let currentResolveResponse;
  const currentPendingResponse=new Promise(currentResolveCallback=>{currentResolveResponse=currentResolveCallback;});
  const {currentTextClient}=createSkillbookTextClient(()=>currentPendingResponse);
  const currentPendingCatalog=currentTextClient.execute('books shop iseulon-bookshop');
  const currentResponseRecord=createBookshopCatalogResponse();
  if(currentResponseMode==='late')currentTextClient.state.me.position.column++;
  if(currentResponseMode==='missing')delete currentResponseRecord.catalog;
  if(currentResponseMode==='version')currentResponseRecord.characterVersion++;
  currentResolveResponse(currentResponseRecord);
  await assert.rejects(currentPendingCatalog);
  assert.equal(currentTextClient.bookshopCatalogQuote,null);
 }
});
