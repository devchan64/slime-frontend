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

test('확정 거래 복구는 조회만 하고 미확정 장애와 다른 요청을 거절한다',async()=>{
 const {recoverWorkshopCreationResult}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
 const currentOriginalRequest={requestId:'22222222-2222-4222-8222-222222222222',kind:'craft',targetId:'iron-sword'};
 const currentReceiptFixture={...currentOriginalRequest,facilityId:'iseulon-workshop',expectedInstanceVersion:null,contractId:currentContractFixture.entries[0].contractId,costP:23};
 const currentRecordedRequests=[];
 const currentRequestClient={async request(currentRequestPath,currentRequestBody){currentRecordedRequests.push([currentRequestPath,currentRequestBody]);return currentReceiptFixture;}};
 assert.equal(await recoverWorkshopCreationResult(currentRequestClient,currentOriginalRequest,'iseulon-workshop'),true);
 assert.equal(currentRecordedRequests.length,1);assert.equal(currentRecordedRequests[0][1],undefined);
 await assert.rejects(()=>recoverWorkshopCreationResult(currentRequestClient,currentOriginalRequest,'other-workshop'));
 await assert.rejects(()=>recoverWorkshopCreationResult({async request(){throw new Error('network failure');}},currentOriginalRequest,'iseulon-workshop'));
});

test('원장 미존재 응답만 원본 요청 재시도를 허용하고 조회 장애는 유지한다',async()=>{
 const currentRecoveryBundle=await build({stdin:{contents:"export {recoverWorkshopCreationResult} from './src/client/workshop'; export {ApiError} from './src/client/response';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
 const {recoverWorkshopCreationResult,ApiError}=await import(`data:text/javascript;base64,${Buffer.from(currentRecoveryBundle.outputFiles[0].text).toString('base64')}`);
 const currentOriginalRequest={requestId:'22222222-2222-4222-8222-222222222222',kind:'craft',targetId:'iron-sword'};
 assert.equal(await recoverWorkshopCreationResult({async request(){throw new ApiError('WORKSHOP_RESULT_NOT_FOUND','없음',404);}},currentOriginalRequest,'iseulon-workshop'),false);
 for(const currentFailureCode of [404,401,500])await assert.rejects(()=>recoverWorkshopCreationResult({async request(){throw new ApiError('OTHER_ERROR','실패',currentFailureCode);}},currentOriginalRequest,'iseulon-workshop'));
});

test('소모품 견적은 수량에 비례하는 제작 시간과 비용을 검증한다',()=>{
 const currentConsumableQuote={...currentQuoteFixture,quote:{...currentQuoteFixture.quote,quantity:3,unitDurationSeconds:30,unitCostP:1,costP:3,durationSeconds:90}};
 assert.equal(parseWorkshopQuote(currentConsumableQuote,'consumable').quote.quantity,3);
 for(const currentInvalidPatch of [{quantity:0},{quantity:1.5},{quantity:1001},{durationSeconds:30},{costP:1},{unitDurationSeconds:0}])
  assert.throws(()=>parseWorkshopQuote({...currentConsumableQuote,quote:{...currentConsumableQuote.quote,...currentInvalidPatch}},'consumable'));
});

test('견적 보유량은 음이 아닌 정수이며 이전 API 응답도 수용한다',()=>{
 assert.equal(parseWorkshopQuote(currentQuoteFixture,'craft').ownedCoins,undefined);
 const currentOwnedFixture={...currentQuoteFixture,ownedCoins:0,materials:[{...currentQuoteFixture.materials[0],ownedQuantity:2}]};
 assert.equal(parseWorkshopQuote(currentOwnedFixture,'craft').materials[0].ownedQuantity,2);
 for(const currentInvalidValue of [-1,1.5,true,null,'3']){
  assert.throws(()=>parseWorkshopQuote({...currentOwnedFixture,ownedCoins:currentInvalidValue},'craft'));
  assert.throws(()=>parseWorkshopQuote({...currentOwnedFixture,materials:[{...currentOwnedFixture.materials[0],ownedQuantity:currentInvalidValue}]},'craft'));
 }
});

test('서버 재료 배분의 필요량·사용량·부족량 일치와 필드 완전성을 검증한다',()=>{
 const currentMaterialAllocation={...currentQuoteFixture.materials[0],materialId:'iron-ore',ownedQuantity:2,consumedQuantity:2,missingQuantity:2};
 const currentAllocatedQuote={...currentQuoteFixture,materials:[currentMaterialAllocation]};
 assert.deepEqual(parseWorkshopQuote(currentAllocatedQuote,'craft').materials[0],currentMaterialAllocation);
 for(const invalidAllocationPatch of [{consumedQuantity:3},{missingQuantity:3},{ownedQuantity:-1},{materialId:''},{consumedQuantity:undefined}])
  assert.throws(()=>parseWorkshopQuote({...currentAllocatedQuote,materials:[{...currentMaterialAllocation,...invalidAllocationPatch}]},'craft'));
 assert.throws(()=>parseWorkshopQuote({...currentAllocatedQuote,materials:[currentMaterialAllocation,currentMaterialAllocation]},'craft'));
 assert.doesNotThrow(()=>parseWorkshopQuote(currentQuoteFixture,'craft'));
});


test('부족 재료를 포함한 소모품 총액과 과거 계약을 모두 검증한다',()=>{
 const currentPricedQuote={...currentQuoteFixture,quote:{...currentQuoteFixture.quote,quantity:3,unitDurationSeconds:30,unitCostP:1,durationSeconds:90,
   baseCostP:3,missingMaterialValueP:15,missingMaterialCostP:23,costP:26,
   materialPricing:{version:1,guildPriceVersion:1,priceSource:'guild_purchase',numerator:3,denominator:2,rounding:'ceil'},
   materialAllocation:[{materialId:'reed-fiber',quantity:6,ownedQuantity:0,consumedQuantity:0,missingQuantity:6,unitPriceP:2},
     {materialId:'clean-water',quantity:3,ownedQuantity:0,consumedQuantity:0,missingQuantity:3,unitPriceP:1}]}};
 assert.equal(parseWorkshopQuote(currentPricedQuote,'consumable').quote.costP,26);
 for(const currentInvalidPatch of [{costP:25},{missingMaterialCostP:22},{baseCostP:4},{missingMaterialValueP:14},{materialPricing:undefined},{materialAllocation:[]}])
   assert.throws(()=>parseWorkshopQuote({...currentPricedQuote,quote:{...currentPricedQuote.quote,...currentInvalidPatch}},'consumable'));
 assert.equal(parseWorkshopContracts(currentContractFixture,'craft').entries.length,1);
});
