import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createCitizenshipState(){return {protocolVersion:1,generation:1,epoch:1,cursor:1,location:{id:'city-channel'},me:{id:'hero',version:1,mode:'FIELD',position:{column:2,row:3}},map:{id:'iseulon',buildings:[{facilityId:'iseulon-guild',facilityKind:'guild',name:'모험가 길드',entrance:{column:2,row:3}}]}};}
function createCitizenshipQuote(){return {cityId:'iseulon',policyVersion:2,priceP:100,serverTime:100,expiresAt:160};}
function setupCitizenshipClient(currentResponseEntries){
 const currentRequestCalls=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestCalls.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length,'예상하지 않은 요청');const currentResponseEntry=currentResponseEntries.shift();
  if(currentResponseEntry instanceof Error)throw currentResponseEntry;
  return new Response(JSON.stringify(currentResponseEntry));
 }});
 currentTextClient.accept(createCitizenshipState());return {currentTextClient,currentRequestCalls};
}
test('길드 발견·100p 견적·발급 재시도는 같은 요청으로 처리한다',async()=>{
 const {currentTextClient,currentRequestCalls}=setupCitizenshipClient([createCitizenshipQuote(),new TypeError('network'),{state:createCitizenshipState()}]);
 assert.match(await currentTextClient.execute('citizenship guilds'),/iseulon-guild.*2,3/);
 assert.match(await currentTextClient.execute('citizenship quote iseulon-guild'),/100p.*1년/);
 await currentTextClient.execute('citizenship buy iseulon-guild');
 assert.deepEqual(currentRequestCalls[1],currentRequestCalls[2]);
 assert.equal(currentRequestCalls[1].body.expectedVersion,1);
 assert.equal(currentRequestCalls[1].body.priceP,100);
 assert.equal(currentRequestCalls[1].body.quotedExpiresAt,160);
 await assert.rejects(currentTextClient.execute('citizenship buy iseulon-guild'),/견적/);
});
test('잘못된 인수·다른 시설·길드 밖·전투 중에는 요청하지 않는다',async()=>{
 const {currentTextClient,currentRequestCalls}=setupCitizenshipClient([]);
 for(const currentCommandText of ['citizenship','citizenship quote','citizenship buy iseulon-guild extra','citizenship quote other-guild','citizenship buy iseulon-guild'])await assert.rejects(currentTextClient.execute(currentCommandText));
 currentTextClient.state.me.position.column=0;await assert.rejects(currentTextClient.execute('citizenship quote iseulon-guild'),/입구/);
 currentTextClient.state=createCitizenshipState();currentTextClient.state.battle={};await assert.rejects(currentTextClient.execute('citizenship quote iseulon-guild'),/전투/);
 assert.equal(currentRequestCalls.length,0);
});
test('다른 도시·과거 추가금·잘못된 기간·누락 견적을 거절한다',async()=>{
 for(const currentQuoteChange of [currentQuoteData=>currentQuoteData.cityId='other',currentQuoteData=>currentQuoteData.priceP=300,currentQuoteData=>currentQuoteData.expiresAt=100,currentQuoteData=>delete currentQuoteData.policyVersion]){
  const currentQuoteData=createCitizenshipQuote();currentQuoteChange(currentQuoteData);
  const {currentTextClient}=setupCitizenshipClient([currentQuoteData]);
  await assert.rejects(currentTextClient.execute('citizenship quote iseulon-guild'),/응답/);
  await assert.rejects(currentTextClient.execute('citizenship buy iseulon-guild'),/견적/);
 }
});
test('만료·상태 버전·채널 변경 후에는 이전 견적으로 구매하지 않는다',async()=>{
 for(const currentClientChange of [currentTextClient=>currentTextClient.citizenshipQuote.deadline=0,currentTextClient=>currentTextClient.state.me.version++,currentTextClient=>currentTextClient.state.epoch++]){
  const {currentTextClient,currentRequestCalls}=setupCitizenshipClient([createCitizenshipQuote()]);
  await currentTextClient.execute('citizenship quote iseulon-guild');currentClientChange(currentTextClient);
  await assert.rejects(currentTextClient.execute('citizenship buy iseulon-guild'),/견적/);assert.equal(currentRequestCalls.length,1);
 }
});
