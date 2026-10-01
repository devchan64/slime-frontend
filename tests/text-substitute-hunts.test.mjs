import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const currentQuoteRecord={policyVersion:1,encounterId:'passive',encounterCatalogVersion:1,speciesId:'slime',monsterReferenceVersion:2,csp:8,enemyCount:2,fpCost:16};
function createHuntClientFixture(currentFailureCount=0,currentLoseReceipt=false){
 const currentRecordedCalls=[];
 let currentRemainingFailures=currentFailureCount;
 const currentTextClient=new TextClient('http://localhost',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  const currentRequestBody=currentRequestOptions.body?JSON.parse(currentRequestOptions.body):null;
  currentRecordedCalls.push({url:currentRequestUrl,body:currentRequestBody});
  if(currentRequestUrl.endsWith('/catalog'))return Response.json({characterVersion:3,fp:50,encounters:[{...currentQuoteRecord,skillVariantId:null,nameTranslations:{ko:'슬라임',en:'Slime'},eligible:true,available:true,unavailableReason:null}]});
  if(currentRequestUrl.endsWith('/substitute-hunts')){
   if(currentLoseReceipt){currentLoseReceipt=false;throw new TypeError('응답 유실');}
   return Response.json({ok:true,kind:'substitute_hunt',requestId:currentRequestBody.requestId,substituteHunt:{...currentQuoteRecord,dropCatalogVersion:1,dissectionPolicyVersion:1,materials:[],fpConsumed:16,fpRemaining:34,characterVersion:4}});
  }
  if(currentRemainingFailures-->0)throw new TypeError('상태 조회 실패');
  return Response.json({protocolVersion:1,generation:1,epoch:2,cursor:0,me:{id:'actor',mode:'AWAY',version:4,fp:34}});
 }});
 currentTextClient.tokens={user_id:'actor',access_token:'test'};
 currentTextClient.accept({protocolVersion:1,generation:1,epoch:1,cursor:0,me:{id:'actor',mode:'AWAY',version:3,fp:50}});
 return {currentTextClient,currentRecordedCalls};
}
test('대체 사냥 목록·빈 드롭·최신 상태를 표시한다',async()=>{
 const {currentTextClient,currentRecordedCalls}=createHuntClientFixture();
 assert.match(await currentTextClient.execute('substitute list'),/슬라임 \[passive\].*16 FP.*실행 가능/);
 assert.match(await currentTextClient.execute('substitute run passive'),/획득한 수집품이 없습니다/);
 assert.equal(currentTextClient.state.me.fp,34);
 assert.equal(currentRecordedCalls.filter(currentCallRecord=>currentCallRecord.body).length,1);
});
test('영수증 이후 상태 조회 실패는 retry에서도 지급을 다시 요청하지 않는다',async()=>{
 const {currentTextClient,currentRecordedCalls}=createHuntClientFixture(2);
 await assert.rejects(currentTextClient.execute('substitute run passive'),/retry/);
 await assert.rejects(currentTextClient.execute('substitute run passive'),/retry/);
 assert.match(await currentTextClient.execute('retry'),/소비 FP 16/);
 assert.equal(currentRecordedCalls.filter(currentCallRecord=>currentCallRecord.body).length,1);
 assert.equal(currentTextClient.pendingCommandRequest,null);
});
test('응답 유실에는 동일 요청 ID와 버전으로만 재시도한다',async()=>{
 const {currentTextClient,currentRecordedCalls}=createHuntClientFixture(0,true);
 await currentTextClient.execute('substitute run passive');
 const currentPostedRequests=currentRecordedCalls.filter(currentCallRecord=>currentCallRecord.body);
 assert.equal(currentPostedRequests.length,2);
 assert.deepEqual(currentPostedRequests[0].body,currentPostedRequests[1].body);
 assert.equal(currentPostedRequests[0].body.expectedVersion,3);
});
test('잘못된 인수는 요청 없이 거절한다',async()=>{
 const {currentTextClient,currentRecordedCalls}=createHuntClientFixture();
 for(const currentInvalidCommand of ['substitute','substitute run','substitute list extra','substitute run ../other'])
  await assert.rejects(currentTextClient.execute(currentInvalidCommand),/입력하세요/);
 assert.equal(currentRecordedCalls.length,0);
});
