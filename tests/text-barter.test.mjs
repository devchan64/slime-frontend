import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
import {parseTravelerBarterSelection,validateTravelerBarterQuote} from '../scripts/text-traveler-permits.mjs';
const CURRENT_GUARD_RECORD={id:'test-guard',cityId:'iseulon',mapId:'field',name:'경비센터',position:{column:1,row:1}};
function createBarterQuoteRecord(){return {guardCenterId:'test-guard',cityId:'iseulon',priceP:5,policyVersion:1,validitySeconds:604800,serverTime:100,expiresAt:160,payment:{cashP:2,materials:{'protein-jelly':4},materialValues:{'protein-jelly':1},totalValueP:6,excessValueP:1}};}
function createBarterClientState(){return {protocolVersion:1,generation:1,epoch:1,cursor:1,location:{id:'field-channel'},me:{id:'hero',version:1,mode:'FIELD',position:{column:1,row:1}},map:{id:'field',guardCenters:[CURRENT_GUARD_RECORD]}};}
test('혼합 납부를 표시하고 응답 유실 시 동일 선택으로 재전송한다',async()=>{
 const currentRequestCalls=[];
 const currentResponseQueue=[createBarterQuoteRecord(),new TypeError('응답 유실'),{state:createBarterClientState()}];
 const currentTextClient=new TextClient('http://localhost',{sleep:async()=>{},fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestCalls.push({url:currentRequestUrl,body:JSON.parse(currentRequestOptions.body)});
  const currentResponseRecord=currentResponseQueue.shift();if(currentResponseRecord instanceof Error)throw currentResponseRecord;
  return new Response(JSON.stringify(currentResponseRecord));
 }});
 currentTextClient.accept(createBarterClientState());
 const currentQuoteOutput=await currentTextClient.execute('permit barter test-guard 2 protein-jelly=4');
 assert.match(currentQuoteOutput,/현금 2p/);assert.match(currentQuoteOutput,/protein-jelly × 4/);assert.match(currentQuoteOutput,/초과 1p \(거스름돈 없음\)/);
 assert.deepEqual(currentRequestCalls[0].body,{cashP:2,materials:{'protein-jelly':4}});
 await currentTextClient.execute('permit buy test-guard');
 assert.deepEqual(currentRequestCalls[1],currentRequestCalls[2]);
 assert.deepEqual(currentRequestCalls[1].body.payment,createBarterQuoteRecord().payment);
});
test('선택 변경·합계 위조·추가 필드가 있는 서버 견적을 거절한다',()=>{
 const currentPaymentSelection={cashP:2,materials:{'protein-jelly':4}};
 for(const currentInvalidPatch of [{cashP:3},{materials:{'protein-jelly':5}},{materialValues:{'protein-jelly':true}},{totalValueP:5},{excessValueP:0},{extra:true}]){
  const currentQuoteRecord=createBarterQuoteRecord();Object.assign(currentQuoteRecord.payment,currentInvalidPatch);
  assert.throws(()=>validateTravelerBarterQuote(currentQuoteRecord,CURRENT_GUARD_RECORD,currentPaymentSelection));
 }
});
test('음수·소수·중복 재료·범위 밖 수량을 거절한다',()=>{
 for(const currentCommandText of ['barter test-guard -1 protein-jelly=4','barter test-guard 0 protein-jelly=1.5','barter test-guard 0 protein-jelly=1 protein-jelly=2','barter test-guard 0 protein-jelly=9007199254740992','barter test-guard 0'])assert.throws(()=>parseTravelerBarterSelection(currentCommandText.split(' ')));
 assert.deepEqual(parseTravelerBarterSelection(['barter','test-guard','0','protein-jelly=5']),{cashP:0,materials:{'protein-jelly':5}});
});
test('견적 뒤 상태 변경은 발급 전 재확인을 요구한다',async()=>{
 let currentRequestCount=0;
 const currentTextClient=new TextClient('http://localhost',{fetcher:async()=>{currentRequestCount++;return new Response(JSON.stringify(createBarterQuoteRecord()));}});
 currentTextClient.accept(createBarterClientState());
 await currentTextClient.execute('permit barter test-guard 2 protein-jelly=4');
 currentTextClient.state.me.version++;
 await assert.rejects(currentTextClient.execute('permit buy test-guard'),/견적/);
 assert.equal(currentRequestCount,1);
});
