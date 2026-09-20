import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentCompiledBundle=await build({entryPoints:['src/client/workshop.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseWorkshopQuote,parseWorkshopContracts,parseWorkshopCatalog}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
const currentQuoteFixture={characterVersion:2,quoteToken:'a'.repeat(64),quote:{costP:23,durationSeconds:600,definitionSnapshot:{name:'철검',englishName:'Sword'}},materials:[{quantity:4,nameTranslations:{ko:'철광석',en:'Iron ore'}}]};
const currentContractFixture={characterVersion:2,serverTime:30,nextCursor:null,entries:[{contractId:'11111111-1111-4111-8111-111111111111',kind:'craft',quote:currentQuoteFixture.quote,startedAt:1,readyAt:20,claimedAt:null,status:'READY'}]};
test('제작·수리 견적과 계약 완료 상태를 검증한다',()=>{
 assert.deepEqual(parseWorkshopQuote(currentQuoteFixture,'craft'),currentQuoteFixture);
 assert.equal(parseWorkshopContracts(currentContractFixture,'craft').entries[0].status,'READY');
 const currentRepairFixture={...currentQuoteFixture,quote:{costP:1,durationSeconds:10,instanceVersion:2,before:{currentDurability:20,maxDurability:80},after:{currentDurability:72,maxDurability:72}}};
 assert.equal(parseWorkshopQuote(currentRepairFixture,'repair').quote.after.maxDurability,72);
 assert.equal(parseWorkshopCatalog({items:[{id:'iron-sword',name:'철검',englishName:'Sword'}]}).length,1);
});
test('잘못된 비용·내구도·서명과 중복 계약·허위 수령 가능 상태를 거절한다',()=>{
 for(const mutateWorkshopFixture of [currentFixture=>currentFixture.quote.costP=-1,currentFixture=>currentFixture.quote.costP=true,
  currentFixture=>currentFixture.quote.durationSeconds=0,currentFixture=>currentFixture.quoteToken='bad',currentFixture=>currentFixture.materials[0].quantity=0]){
  const currentInvalidFixture=structuredClone(currentQuoteFixture);mutateWorkshopFixture(currentInvalidFixture);assert.throws(()=>parseWorkshopQuote(currentInvalidFixture,'craft'));
 }
 for(const mutateWorkshopFixture of [currentFixture=>currentFixture.entries.push(currentFixture.entries[0]),currentFixture=>currentFixture.serverTime=10,currentFixture=>currentFixture.entries[0].kind='repair']){
  const currentInvalidFixture=structuredClone(currentContractFixture);mutateWorkshopFixture(currentInvalidFixture);assert.throws(()=>parseWorkshopContracts(currentInvalidFixture,'craft'));
 }
});
