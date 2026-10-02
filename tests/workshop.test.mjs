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
 currentPricedQuote.materials=currentPricedQuote.quote.materialAllocation.map(currentMaterialEntry=>({...currentMaterialEntry,nameTranslations:{ko:currentMaterialEntry.materialId,en:currentMaterialEntry.materialId}}));
 assert.equal(parseWorkshopQuote(currentPricedQuote,'consumable').quote.costP,26);
 assert.doesNotThrow(()=>parseWorkshopQuote({...currentPricedQuote,materials:[...currentPricedQuote.materials].reverse()},'consumable'));
 for(const currentChangedMaterials of [[],currentPricedQuote.materials.slice(1),
   [{...currentPricedQuote.materials[0],materialId:'other-material'},currentPricedQuote.materials[1]],
   [{...currentPricedQuote.materials[0],quantity:7,missingQuantity:7},currentPricedQuote.materials[1]],
   [{...currentPricedQuote.materials[0],ownedQuantity:1,consumedQuantity:1,missingQuantity:5},currentPricedQuote.materials[1]]]){
   assert.throws(()=>parseWorkshopQuote({...currentPricedQuote,materials:currentChangedMaterials},'consumable'));
 }

 const currentSavedContract={...currentContractFixture,entries:[{...currentContractFixture.entries[0],kind:'consumable',quote:currentPricedQuote.quote}]};
 assert.equal(parseWorkshopContracts(currentSavedContract,'consumable').entries[0].quote.missingMaterialCostP,23);
 for(const currentInvalidPatch of [{costP:25},{missingMaterialCostP:22},{baseCostP:4},{missingMaterialValueP:14},{materialPricing:undefined},{materialAllocation:[]}])
   assert.throws(()=>parseWorkshopQuote({...currentPricedQuote,quote:{...currentPricedQuote.quote,...currentInvalidPatch}},'consumable'));
 assert.equal(parseWorkshopContracts(currentContractFixture,'craft').entries.length,1);
});


test('품목·수량·수리 개체가 선택과 다른 견적을 거절한다',()=>{
 const currentCraftQuote={...currentQuoteFixture,quote:{...currentQuoteFixture.quote,definitionId:'iron-sword'}};
 assert.doesNotThrow(()=>parseWorkshopQuote(currentCraftQuote,'craft',{targetId:'iron-sword'}));
 assert.throws(()=>parseWorkshopQuote(currentCraftQuote,'craft',{targetId:'leather-vest'}));
 const currentConsumableQuote={...currentCraftQuote,quote:{...currentCraftQuote.quote,definitionId:'clean-bandage',quantity:2,unitDurationSeconds:30,unitCostP:1,durationSeconds:60,costP:2}};
 assert.doesNotThrow(()=>parseWorkshopQuote(currentConsumableQuote,'consumable',{targetId:'clean-bandage',quantity:2}));
 for(const currentRequestedQuantity of [1,3,0,1001,true])assert.throws(()=>parseWorkshopQuote(currentConsumableQuote,'consumable',{targetId:'clean-bandage',quantity:currentRequestedQuantity}));
 const currentRepairQuote={...currentQuoteFixture,quote:{costP:1,durationSeconds:10,instanceId:'11111111-1111-4111-8111-111111111111',instanceVersion:2,before:{currentDurability:20,maxDurability:80},after:{currentDurability:72,maxDurability:72}}};
 assert.doesNotThrow(()=>parseWorkshopQuote(currentRepairQuote,'repair',{targetId:currentRepairQuote.quote.instanceId}));
 assert.throws(()=>parseWorkshopQuote(currentRepairQuote,'repair',{targetId:'22222222-2222-4222-8222-222222222222'}));
});

test('생산 견적 레벨·품질·성능 계약을 검증한다',()=>{
 const currentFixture=structuredClone(currentQuoteFixture);
 currentFixture.quote.definitionId='iron-sword';
 currentFixture.quote.productionResult={productId:'iron-sword',usage:'equipment',itemLevel:2,levelPolicyVersion:1,performanceVersion:1,quality:{numerator:3,denominator:2},performance:{attack_flat_bonus:3,defense_flat_bonus:0,maximum_durability_value:96}};
 assert.equal(parseWorkshopQuote(currentFixture,'craft').quote.productionResult.itemLevel,2);
 for(const currentPatch of [{itemLevel:1},{itemLevel:true},{performanceVersion:0},{productId:'wrong'},{quality:{numerator:3,denominator:0}}]){
  const currentInvalidFixture=structuredClone(currentFixture);Object.assign(currentInvalidFixture.quote.productionResult,currentPatch);assert.throws(()=>parseWorkshopQuote(currentInvalidFixture,'craft'));
 }
});

test('혼합 재료 카탈로그와 견적의 품목·수량 대응을 검증한다',()=>{
 const currentCatalog={items:[{id:'leather-vest',name:'조끼',englishName:'Vest',materialSelection:{requiredQuantity:4,defaultMaterialId:'leather-low',choices:[{materialId:'leather-low',grade:'low',ownedQuantity:2,nameTranslations:{ko:'가죽',en:'Leather'}}]}}]};
 assert.equal(parseWorkshopCatalog(currentCatalog)[0].materialSelection.requiredQuantity,4);
 for(const currentPatch of [{requiredQuantity:0},{defaultMaterialId:'missing'},{choices:[]},{choices:[currentCatalog.items[0].materialSelection.choices[0],currentCatalog.items[0].materialSelection.choices[0]]}]){
  const currentInvalid=structuredClone(currentCatalog);Object.assign(currentInvalid.items[0].materialSelection,currentPatch);assert.throws(()=>parseWorkshopCatalog(currentInvalid));
 }
 const currentQuote=structuredClone(currentQuoteFixture);currentQuote.quote.definitionId='iron-sword';currentQuote.quote.selectedMaterials=[{materialId:'iron-low',quantity:4}];
 assert.throws(()=>parseWorkshopQuote(currentQuote,'craft',{targetId:'iron-sword',materialInputs:[{materialId:'iron-high',quantity:4}]}));
});

test('혼합 제작의 복구 영수증이 다른 재료라면 성공으로 처리하지 않는다',async()=>{
 const {recoverWorkshopCreationResult}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
 const currentOriginalRequest={requestId:'11111111-1111-4111-8111-111111111111',kind:'craft',targetId:'iron-sword',materialInputs:[{materialId:'iron-low',quantity:4}]};
 const currentReceipt={...currentOriginalRequest,facilityId:'iseulon-workshop',expectedInstanceVersion:null,contractId:'22222222-2222-4222-8222-222222222222',costP:23,materials:[{materialId:'iron-high',quantity:4}]};
 await assert.rejects(()=>recoverWorkshopCreationResult({async request(){return currentReceipt;}},currentOriginalRequest,'iseulon-workshop'));
 currentReceipt.materials=currentOriginalRequest.materialInputs;
 assert.equal(await recoverWorkshopCreationResult({async request(){return currentReceipt;}},currentOriginalRequest,'iseulon-workshop'),true);
});
test('신규 회복 소모품 생산 견적과 고정 성능을 검증한다',()=>{
 const currentConsumableQuote={...currentQuoteFixture,quote:{definitionId:'gel-ration',definitionSnapshot:{name:'젤 곡물식',englishName:'Gel Ration',effect:'restore_hp'},quantity:1,unitDurationSeconds:90,unitCostP:1,costP:1,durationSeconds:90,
 productionResult:{productId:'gel-ration',usage:'consumable',itemLevel:1,levelPolicyVersion:1,performanceVersion:1,quality:{numerator:1,denominator:1},performance:{restoration_hp_value:3}}}};
 assert.equal(parseWorkshopQuote(currentConsumableQuote,'consumable').quote.productionResult.itemLevel,1);
 for(const currentResultPatch of [{usage:'equipment'},{itemLevel:2},{performance:{restoration_hp_value:0}},{performance:{restoration_hp_value:3,attack_flat_bonus:1}}]){
  const currentInvalidQuote=structuredClone(currentConsumableQuote);Object.assign(currentInvalidQuote.quote.productionResult,currentResultPatch);
  assert.throws(()=>parseWorkshopQuote(currentInvalidQuote,'consumable'));
 }
});
test('소모품 카탈로그의 다중 슬롯과 슬롯 간 중복을 검증한다',()=>{
 const currentSlotItem=currentIdentifier=>({slotId:currentIdentifier,requiredQuantity:1,defaultMaterialId:currentIdentifier,choices:[{materialId:currentIdentifier,grade:'low',ownedQuantity:2,nameTranslations:{ko:'재료',en:'Material'}}]});
 const currentCatalogResponse={items:[{id:'gel-ration',name:'식량',englishName:'Ration',materialSlots:[currentSlotItem('gelatin-low'),currentSlotItem('grain-flour-low')]}]};
 assert.equal(parseWorkshopCatalog(currentCatalogResponse)[0].materialSlots.length,2);
 for(const currentSlotList of [[],[currentSlotItem('same'),currentSlotItem('same')],[{...currentSlotItem('gelatin-low'),requiredQuantity:0}]]){
  assert.throws(()=>parseWorkshopCatalog({items:[{...currentCatalogResponse.items[0],materialSlots:currentSlotList}]}));
 }
 const currentDuplicateChoice={...currentSlotItem('gelatin-low'),slotId:'different'};
 assert.throws(()=>parseWorkshopCatalog({items:[{...currentCatalogResponse.items[0],materialSlots:[currentSlotItem('gelatin-low'),currentDuplicateChoice]}]}));
});
test('표식 생산 견적은 고정 유지 시간과 효과 종류를 검증한다',()=>{
 const currentMarkerQuote={...currentQuoteFixture,quote:{definitionId:'moth-lamp',definitionSnapshot:{name:'등불',englishName:'Lamp',effect:'place_light_marker'},quantity:1,unitDurationSeconds:60,unitCostP:3,costP:3,durationSeconds:60,productionResult:{productId:'moth-lamp',usage:'consumable',itemLevel:2,levelPolicyVersion:1,performanceVersion:1,quality:{numerator:3,denominator:2},performance:{effect_duration_seconds:72}}}};
 assert.equal(parseWorkshopQuote(currentMarkerQuote,'consumable').quote.productionResult.itemLevel,2);
 for(const currentPerformance of [{effect_duration_seconds:0},{restoration_hp_value:3},{effect_duration_seconds:72,restoration_hp_value:3}]){
  const currentInvalidQuote=structuredClone(currentMarkerQuote);currentInvalidQuote.quote.productionResult.performance=currentPerformance;assert.throws(()=>parseWorkshopQuote(currentInvalidQuote,'consumable'));
 }
});

function createMaterialQuoteFixture(){
 const currentMaterialInputs=[{materialId:'tanned-leather-low',quantity:3},{materialId:'tanned-leather-medium',quantity:1}];
 return {characterVersion:3,quoteToken:'b'.repeat(64),ownedCoins:1000,
  quote:{definitionId:'leather-cord',definitionSnapshot:{name:'표준 가죽끈',englishName:'Leather Cord'},
   quantity:4,unitDurationSeconds:45,unitCostP:2,costP:8,durationSeconds:180,requiredMaterials:currentMaterialInputs,
   productionResult:{productId:'leather-cord',usage:'material',itemLevel:1,levelPolicyVersion:1,performanceVersion:1,
    quality:{numerator:5,denominator:4},performance:{material_strength_percent:100}}},
  materials:currentMaterialInputs.map(currentInputRecord=>({...currentInputRecord,ownedQuantity:currentInputRecord.quantity,
   consumedQuantity:currentInputRecord.quantity,missingQuantity:0,nameTranslations:{ko:'가죽',en:'Leather'}}))};
}

test('중간재 견적과 계약은 혼합 품질·레벨·수량·고정 강도를 검증한다',()=>{
 const currentMaterialQuote=createMaterialQuoteFixture();
 const currentQuoteSelection={targetId:'leather-cord',quantity:4,materialInputs:currentMaterialQuote.quote.requiredMaterials};
 assert.equal(parseWorkshopQuote(currentMaterialQuote,'material',currentQuoteSelection).quote.productionResult.itemLevel,1);
 const currentMaterialContracts={...currentContractFixture,entries:[{...currentContractFixture.entries[0],kind:'material',quote:currentMaterialQuote.quote}]};
 assert.equal(parseWorkshopContracts(currentMaterialContracts,'material').entries[0].quote.quantity,4);
 assert.throws(()=>parseWorkshopContracts(currentMaterialContracts,'consumable'));
 for(const currentInvalidSelection of [{...currentQuoteSelection,quantity:3},{...currentQuoteSelection,targetId:'woven-cloth'},
  {...currentQuoteSelection,materialInputs:[{materialId:'tanned-leather-low',quantity:4}]}]){
  assert.throws(()=>parseWorkshopQuote(currentMaterialQuote,'material',currentInvalidSelection));
 }
});

test('중간재의 미고정 결과·소모품 위조·잘못된 강도·대량 수량 불일치를 거절한다',()=>{
 for(const currentInvalidResult of [undefined,null,
  {...createMaterialQuoteFixture().quote.productionResult,usage:'consumable'},
  {...createMaterialQuoteFixture().quote.productionResult,productId:'woven-cloth'},
  {...createMaterialQuoteFixture().quote.productionResult,itemLevel:2},
  {...createMaterialQuoteFixture().quote.productionResult,quality:{numerator:3,denominator:0}},
  {...createMaterialQuoteFixture().quote.productionResult,performanceVersion:true}]){
  const currentInvalidQuote=createMaterialQuoteFixture();currentInvalidQuote.quote.productionResult=currentInvalidResult;
  assert.throws(()=>parseWorkshopQuote(currentInvalidQuote,'material'));
 }
 for(const currentInvalidPerformance of [{material_strength_percent:0},{material_strength_percent:true},{material_strength_percent:1.5},
  {restoration_hp_value:3},{material_strength_percent:100,restoration_hp_value:3}]){
  const currentInvalidQuote=createMaterialQuoteFixture();currentInvalidQuote.quote.productionResult.performance=currentInvalidPerformance;
  assert.throws(()=>parseWorkshopQuote(currentInvalidQuote,'material'));
 }
 for(const currentInvalidFields of [{quantity:0},{quantity:1001},{quantity:true},{costP:2},{durationSeconds:45},{unitCostP:0}]){
  const currentInvalidQuote=createMaterialQuoteFixture();Object.assign(currentInvalidQuote.quote,currentInvalidFields);
  assert.throws(()=>parseWorkshopQuote(currentInvalidQuote,'material'));
 }
});

test('중간재 과거 계약의 고정 성능은 현재 표를 추측하여 덮어쓰지 않는다',()=>{
 const currentSavedQuote=createMaterialQuoteFixture();
 currentSavedQuote.quote.productionResult.performanceVersion=9;
 currentSavedQuote.quote.productionResult.performance.material_strength_percent=135;
 const currentOriginalQuote=structuredClone(currentSavedQuote);
 assert.equal(parseWorkshopQuote(currentSavedQuote,'material').quote.productionResult.performance.material_strength_percent,135);
 assert.deepEqual(currentSavedQuote,currentOriginalQuote);
 assert.throws(()=>parseWorkshopQuote(currentSavedQuote,'unsupported'));
 assert.throws(()=>parseWorkshopContracts({...currentContractFixture,entries:[]},'unsupported'));
});

 test('중간재 응답 유실 복구는 주문 수량과 재료까지 일치해야 한다',async()=>{
 const {recoverWorkshopCreationResult}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
 const currentOriginalRequest={requestId:'22222222-2222-4222-8222-222222222222',kind:'material',targetId:'leather-cord',quantity:4,materialInputs:createMaterialQuoteFixture().quote.requiredMaterials};
 const currentReceiptFixture={...currentOriginalRequest,materials:currentOriginalRequest.materialInputs,facilityId:'iseulon-workshop',expectedInstanceVersion:null,contractId:currentContractFixture.entries[0].contractId,costP:8};
 const currentRequestClient={async request(currentRequestPath,currentRequestBody){assert.equal(currentRequestBody,undefined);assert.match(currentRequestPath,/kind=material$/);return currentReceiptFixture;}};
 assert.equal(await recoverWorkshopCreationResult(currentRequestClient,currentOriginalRequest,'iseulon-workshop'),true);
 currentReceiptFixture.quantity=3;
 await assert.rejects(()=>recoverWorkshopCreationResult(currentRequestClient,currentOriginalRequest,'iseulon-workshop'));
 });
