import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const PROCESSING_TEST_CONTRACT='aaaaaaaa-1111-2222-3333-444444444444';
function createProcessingState(currentStateVersion=4){return {protocolVersion:1,generation:1,epoch:1,cursor:currentStateVersion,me:{id:'player',mode:'FIELD',version:currentStateVersion,position:{column:2,row:3}},location:{id:'channel'},map:{id:'city',buildings:[{facilityKind:'workshop',facilityId:'city-workshop',name:'공방',entrance:{column:2,row:3}}]}};}
function createProcessingQuote(){return {characterVersion:4,ownedCoins:10,quoteToken:'a'.repeat(64),quote:{collectionId:'iron-ore',processingMethod:'smelting',grade:'low',outputQuantity:1,inputQuantity:2,costP:1,durationSeconds:30,ownedQuantity:2,outputMaterial:{materialId:'iron-ingot-low',name:'하급 철괴',englishName:'Low iron',materialKind:'material',essenceAttribute:null}}};}
function setupProcessingClient(currentResponseEntries){
 const currentRequestEntries=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestEntries.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length,'예상하지 않은 요청');
  const currentResponseEntry=currentResponseEntries.shift();
  if(currentResponseEntry instanceof Error)throw currentResponseEntry;
  return new Response(JSON.stringify(currentResponseEntry.body??currentResponseEntry),{status:currentResponseEntry.status??200});
 }});
 currentTextClient.accept(createProcessingState());return {currentTextClient,currentRequestEntries};
}
test('작업장 발견·가공 목록·견적 뒤 같은 요청 ID로 계약 재시도',async()=>{
 const currentQuoteData=createProcessingQuote();
 const {currentTextClient,currentRequestEntries}=setupProcessingClient([{facilityId:'city-workshop',available:true,unavailableReason:null,grades:['low'],entries:[currentQuoteData.quote]},currentQuoteData,new TypeError('network'),{state:createProcessingState(5)}]);
 assert.match(await currentTextClient.execute('processing facilities'),/city-workshop.*2,3/);
 assert.match(await currentTextClient.execute('processing catalog city-workshop'),/정련.*일반 가공재/);
 assert.match(await currentTextClient.execute('processing quote city-workshop iron-ore low 1'),/보유 원재료 2개/);
 await currentTextClient.execute('processing create city-workshop');
 assert.deepEqual(currentRequestEntries[2].body,currentRequestEntries[3].body);
 assert.equal(currentRequestEntries[2].body.expectedVersion,4);
 assert.equal(currentRequestEntries[2].body.quoteToken,'a'.repeat(64));
 assert.equal(currentTextClient.state.me.version,5);
 await assert.rejects(currentTextClient.execute('processing create city-workshop'),/견적/);
});
test('가공 계약 페이지·커서와 수령 API의 엄격한 본문·재시도',async()=>{
 const currentContractPage={serverTime:150,characterVersion:4,nextCursor:PROCESSING_TEST_CONTRACT,entries:[{contractId:PROCESSING_TEST_CONTRACT,facilityId:'city-workshop',startedAt:100,readyAt:130,claimedAt:null,status:'READY',quote:createProcessingQuote().quote}]};
 const {currentTextClient,currentRequestEntries}=setupProcessingClient([currentContractPage,new TypeError('network'),{state:createProcessingState(5)}]);
 assert.match(await currentTextClient.execute('processing contracts city-workshop '+PROCESSING_TEST_CONTRACT),/수령 가능.*\n다음커서:/);
 assert.ok(currentRequestEntries[0].url.endsWith('?after='+PROCESSING_TEST_CONTRACT));
 await currentTextClient.execute('processing claim city-workshop '+PROCESSING_TEST_CONTRACT);
 assert.deepEqual(currentRequestEntries[1].body,{expectedVersion:4});
 assert.deepEqual(currentRequestEntries[1],currentRequestEntries[2]);
});
test('잘못된 인수·전투 중 요청·미확인 견적 계약은 전송하지 않는다',async()=>{
 const {currentTextClient,currentRequestEntries}=setupProcessingClient([]);
 for(const currentCommandText of ['processing','processing catalog ../bad','processing claim city-workshop invalid','processing contracts city-workshop invalid','processing quote city-workshop iron-ore low 0','processing quote city-workshop iron-ore low 1001','processing quote city-workshop iron-ore wrong 1','processing create city-workshop'])await assert.rejects(currentTextClient.execute(currentCommandText));
 currentTextClient.state.battle={id:'battle'};
 await assert.rejects(currentTextClient.execute('processing catalog city-workshop'),/전투/);
 assert.equal(currentRequestEntries.length,0);
});
test('캐릭터 버전·채널·위치 변경 후 이전 견적을 사용하지 않는다',async()=>{
 for(const currentStateChange of [currentGameState=>currentGameState.me.version++,currentGameState=>currentGameState.epoch++,currentGameState=>currentGameState.me.position.column++]){
  const {currentTextClient,currentRequestEntries}=setupProcessingClient([createProcessingQuote()]);
  await currentTextClient.execute('processing quote city-workshop iron-ore low 1');currentStateChange(currentTextClient.state);
  await assert.rejects(currentTextClient.execute('processing create city-workshop'),/견적/);assert.equal(currentRequestEntries.length,1);
 }
});
test('조건이 다른 견적·잘못된 가공 메타데이터·자금 부족을 거절한다',async()=>{
 for(const currentQuoteChange of [currentQuoteData=>currentQuoteData.quote.collectionId='wrong',currentQuoteData=>currentQuoteData.characterVersion++,currentQuoteData=>currentQuoteData.quote.outputMaterial.essenceAttribute='water']){
  const currentQuoteData=createProcessingQuote();currentQuoteChange(currentQuoteData);
  const {currentTextClient}=setupProcessingClient([currentQuoteData]);
  await assert.rejects(currentTextClient.execute('processing quote city-workshop iron-ore low 1'));
  await assert.rejects(currentTextClient.execute('processing create city-workshop'));
 }
 const currentQuoteData=createProcessingQuote();currentQuoteData.ownedCoins=0;
 const {currentTextClient}=setupProcessingClient([currentQuoteData]);
 await currentTextClient.execute('processing quote city-workshop iron-ore low 1');
 await assert.rejects(currentTextClient.execute('processing create city-workshop'),/부족/);
});
test('다른 시설의 목록·계약을 표시하지 않고 HTTP 거절을 재시도하지 않는다',async()=>{
 const {currentTextClient,currentRequestEntries}=setupProcessingClient([{facilityId:'wrong',available:true,unavailableReason:null,grades:['low'],entries:[]},{status:409,body:{code:'STATE_CHANGED',messages:{ko:'상태 변경'}}}]);
 await assert.rejects(currentTextClient.execute('processing catalog city-workshop'),/일치/);
 await assert.rejects(currentTextClient.execute('processing claim city-workshop '+PROCESSING_TEST_CONTRACT),/상태 변경/);
 assert.equal(currentRequestEntries.length,2);
});


test('가공 수령 응답을 연속 유실해도 원래 버전으로 결과를 재확인한다',async()=>{
 const {currentTextClient,currentRequestEntries}=setupProcessingClient([new TypeError('첫 응답 유실'),new TypeError('재전송 응답 유실'),{state:createProcessingState(5)}]);
 await assert.rejects(currentTextClient.execute('processing claim city-workshop '+PROCESSING_TEST_CONTRACT),/retry/);
 assert.ok(currentTextClient.pendingCommandRequest);
 currentTextClient.accept(createProcessingState(5));
 await assert.rejects(currentTextClient.execute('processing claim city-workshop '+PROCESSING_TEST_CONTRACT),/retry/);
 await currentTextClient.execute('retry');
 assert.equal(currentTextClient.pendingCommandRequest,null);
 assert.equal(currentRequestEntries.length,3);
 for(const currentRequestEntry of currentRequestEntries){
  assert.deepEqual(currentRequestEntry,currentRequestEntries[0]);
  assert.deepEqual(currentRequestEntry.body,{expectedVersion:4});
 }
});
