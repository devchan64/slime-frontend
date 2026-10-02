import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const CURRENT_CONTRACT_IDENTIFIER='11111111-1111-4111-8111-111111111111';
function createConsumableState(currentCharacterVersion=4){return {protocolVersion:1,generation:1,epoch:1,cursor:currentCharacterVersion,me:{id:'character',version:currentCharacterVersion,mode:'FIELD',position:{column:2,row:3}},map:{buildings:[{facilityId:'iseulon-workshop',facilityKind:'workshop',entrance:{column:2,row:3}}]}};}
function createConsumableQuote(){return {characterVersion:4,ownedCoins:10,quoteToken:'a'.repeat(64),quote:{definitionId:'clean-bandage',definitionSnapshot:{name:'깨끗한 붕대',englishName:'Clean bandage'},quantity:2,costP:2,durationSeconds:60,unitCostP:1,unitDurationSeconds:30},materials:[{quantity:4,ownedQuantity:4,nameTranslations:{ko:'실',en:'Thread'}}]};}
function createConsumableClient(currentResponseEntries){
 const currentRequestEntries=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestEntries.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length);
  const currentResponseRecord=currentResponseEntries.shift();
  if(currentResponseRecord instanceof Error)throw currentResponseRecord;
  return new Response(JSON.stringify(currentResponseRecord));
 }});
 currentTextClient.accept(createConsumableState());
 return {currentTextClient,currentRequestEntries};
}
test('소모품 견적·계약·수령은 같은 요청을 재시도하고 수령에는 요청 ID를 넣지 않는다',async()=>{
 const {currentTextClient,currentRequestEntries}=createConsumableClient([createConsumableQuote(),new TypeError('응답 유실'),new TypeError('응답 유실'),{state:createConsumableState(5)},{state:createConsumableState(6)}]);
 assert.match(await currentTextClient.execute('consumables quote iseulon-workshop clean-bandage 2'),/깨끗한 붕대 × 2 · 2P · 60초/);
 await assert.rejects(currentTextClient.execute('consumables create iseulon-workshop'),/retry/);
 await currentTextClient.execute('retry');
 assert.deepEqual(currentRequestEntries[1],currentRequestEntries[2]);
 assert.deepEqual(currentRequestEntries[2],currentRequestEntries[3]);
 assert.equal(currentRequestEntries[1].body.quantity,2);
 assert.equal(currentRequestEntries[1].body.kind,'consumable');
 await currentTextClient.execute('consumables claim iseulon-workshop '+CURRENT_CONTRACT_IDENTIFIER);
 assert.deepEqual(currentRequestEntries[4].body,{kind:'consumable',expectedVersion:5});
});
test('잘못된 품목·수량·원격 이용·변경된 견적은 계약하지 않는다',async()=>{
 const {currentTextClient,currentRequestEntries}=createConsumableClient([createConsumableQuote()]);
 for(const currentCommandText of ['consumables quote iseulon-workshop clean-bandage 0','consumables quote iseulon-workshop clean-bandage 1001','consumables quote iseulon-workshop ../bad 1','consumables claim iseulon-workshop bad'])await assert.rejects(currentTextClient.execute(currentCommandText));
 assert.equal(currentRequestEntries.length,0);
 await currentTextClient.execute('consumables quote iseulon-workshop clean-bandage 2');
 currentTextClient.accept(createConsumableState(5));
 await assert.rejects(currentTextClient.execute('consumables create iseulon-workshop'),/견적/);
 currentTextClient.state.me.position.column=0;
 await assert.rejects(currentTextClient.execute('consumables catalog iseulon-workshop'),/입구/);
 assert.equal(currentRequestEntries.length,1);
});
test('다른 품목이나 수량의 견적은 저장하지 않는다',async()=>{
 for(const currentChangedQuote of [{...createConsumableQuote().quote,definitionId:'other'},{...createConsumableQuote().quote,quantity:1,costP:1,durationSeconds:30}]){
  const {currentTextClient}=createConsumableClient([{...createConsumableQuote(),quote:currentChangedQuote}]);
  await assert.rejects(currentTextClient.execute('consumables quote iseulon-workshop clean-bandage 2'),/형식/);
  await assert.rejects(currentTextClient.execute('consumables create iseulon-workshop'),/견적/);
 }
});
