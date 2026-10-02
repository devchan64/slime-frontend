import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createGuildSaleState(){return {protocolVersion:1,generation:1,epoch:1,cursor:1,location:{id:'city-channel'},map:{id:'iseulon'},me:{id:'hero',version:1,mode:'FIELD',position:{column:2,row:3}}};}
function createGuildSaleQuote(){return {characterVersion:1,policyVersion:2,maximumQuantity:100,materialId:'iron-ingot-low',quantity:2,unitPriceP:3,totalPriceP:6};}
function setupGuildSaleClient(currentResponseEntries){
 const currentRequestCalls=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestCalls.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length,'예상하지 않은 요청');const currentResponseEntry=currentResponseEntries.shift();
  if(currentResponseEntry instanceof Error)throw currentResponseEntry;
  return new Response(JSON.stringify(currentResponseEntry));
 }});currentTextClient.accept(createGuildSaleState());return {currentTextClient,currentRequestCalls};
}
test('원물·가공재 목록과 견적 확인 후 동일 요청으로 판매를 재시도한다',async()=>{
 const currentCatalogData={characterVersion:1,policyVersion:2,maximumQuantity:100,items:[{materialId:'iron-ingot-low',quantity:2,unitPriceP:3,nameTranslations:{ko:'철괴',en:'Iron'}},{materialId:'hide',quantity:4,unitPriceP:1,nameTranslations:{ko:'가죽',en:'Hide'}}]};
 const {currentTextClient,currentRequestCalls}=setupGuildSaleClient([currentCatalogData,createGuildSaleQuote(),new TypeError('network'),{state:createGuildSaleState()}]);
 const currentCatalogText=await currentTextClient.execute('materials list iseulon-guild');assert.match(currentCatalogText,/iron-ingot-low/);assert.match(currentCatalogText,/hide/);
 assert.match(await currentTextClient.execute('materials quote iseulon-guild iron-ingot-low 2'),/수령 6P/);
 await currentTextClient.execute('materials sell iseulon-guild');
 assert.deepEqual(currentRequestCalls[2],currentRequestCalls[3]);assert.equal(currentRequestCalls[2].body.unitPriceP,3);assert.equal(currentRequestCalls[2].body.expectedVersion,1);
 await assert.rejects(currentTextClient.execute('materials sell iseulon-guild'),/견적/);
});
test('미확인 판매·잘못된 수량·전투·다른 시설의 판매를 차단한다',async()=>{
 const {currentTextClient,currentRequestCalls}=setupGuildSaleClient([createGuildSaleQuote()]);
 for(const currentCommandText of ['materials','materials list ../guild','materials quote iseulon-guild hide -1','materials quote iseulon-guild hide 1.5','materials sell iseulon-guild'])await assert.rejects(currentTextClient.execute(currentCommandText));
 await currentTextClient.execute('materials quote iseulon-guild iron-ingot-low 2');
 await assert.rejects(currentTextClient.execute('materials sell other-guild'),/견적/);
 currentTextClient.state.battle={};await assert.rejects(currentTextClient.execute('materials sell iseulon-guild'),/전투/);
 assert.equal(currentRequestCalls.length,1);
});
test('잘못된 견적 합계·다른 재료·오래된 버전은 저장하지 않는다',async()=>{
 for(const currentQuoteChange of [currentQuoteData=>currentQuoteData.totalPriceP=7,currentQuoteData=>currentQuoteData.materialId='hide',currentQuoteData=>currentQuoteData.characterVersion=2]){
  const currentQuoteData=createGuildSaleQuote();currentQuoteChange(currentQuoteData);const {currentTextClient}=setupGuildSaleClient([currentQuoteData]);
  await assert.rejects(currentTextClient.execute('materials quote iseulon-guild iron-ingot-low 2'));
  await assert.rejects(currentTextClient.execute('materials sell iseulon-guild'));
 }
});
test('견적 이후 채널·위치·재고 버전 변경은 재견적을 요구한다',async()=>{
 for(const currentStateChange of [currentGameState=>currentGameState.epoch++,currentGameState=>currentGameState.me.position.column++,currentGameState=>currentGameState.me.version++]){
  const {currentTextClient,currentRequestCalls}=setupGuildSaleClient([createGuildSaleQuote()]);
  await currentTextClient.execute('materials quote iseulon-guild iron-ingot-low 2');currentStateChange(currentTextClient.state);
  await assert.rejects(currentTextClient.execute('materials sell iseulon-guild'),/견적/);assert.equal(currentRequestCalls.length,1);
 }
});
