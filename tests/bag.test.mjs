import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild = await build({entryPoints:['src/client/bag.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseBagInventory} = await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function createBagResponse() {
  return {serverTime:100,characterVersion:2,knownEquipmentWeightG:1400,nextCursor:null,slots:{},items:[],bag:{capacityG:20000,knownWeightG:1600,unknownWeightQuantity:3,items:[
    {id:'protein-jelly',kind:'material',quantity:2,nameTranslations:{ko:'젤리',en:'Jelly'},description:'재료',weightG:100},
    {id:'iron-ore',kind:'material',quantity:3,nameTranslations:{ko:'철광석',en:'Iron ore'},description:'재료',weightG:null},
  ]}};
}
test('붕대 소모품의 수량과 미정 무게도 가방 합계에 포함한다',()=>{
  const currentBagResponse=createBagResponse();
  currentBagResponse.bag.items.push({id:'clean-bandage',kind:'consumable',quantity:2,nameTranslations:{ko:'깨끗한 붕대',en:'Clean Bandage'},description:'응급처치 재료',weightG:null});
  currentBagResponse.bag.unknownWeightQuantity+=2;
  assert.equal(parseBagInventory(currentBagResponse).bag.unknownWeightQuantity,5);
});
test('직접 회복 소모품만 양수 회복량과 소비 수량을 제공한다',()=>{
  const currentBagResponse=createBagResponse();
  currentBagResponse.bag.items[0].kind='consumable';
  currentBagResponse.bag.items[0].useAction={type:'RESTORE_HP',restorationHp:3,consumedOnSuccess:1};
  assert.equal(parseBagInventory(currentBagResponse).bag.items[0].useAction.restorationHp,3);
  for(const currentActionValue of [null,{type:'ATTACK',restorationHp:3,consumedOnSuccess:1},{type:'RESTORE_HP',restorationHp:0,consumedOnSuccess:1},{type:'RESTORE_HP',restorationHp:3,consumedOnSuccess:true}]) {
    currentBagResponse.bag.items[0].useAction=currentActionValue;
    assert.throws(()=>parseBagInventory(currentBagResponse),/소모품/);
  }
});
test('표식 사용에는 종류와 양수 유지 시간이 필요하다',()=>{
  const currentBagResponse=createBagResponse();
  currentBagResponse.bag.items[0].kind='consumable';
  currentBagResponse.bag.items[0].useAction={type:'PLACE_MARKER',markerKind:'ROUTE',validSeconds:120,consumedOnSuccess:1};
  assert.equal(parseBagInventory(currentBagResponse).bag.items[0].useAction.validSeconds,120);
  for(const currentMarkerChange of [{markerKind:'RISK'},{validSeconds:0},{validSeconds:true}]) {
    const currentInvalidResponse=structuredClone(currentBagResponse);
    Object.assign(currentInvalidResponse.bag.items[0].useAction,currentMarkerChange);
    assert.throws(()=>parseBagInventory(currentInvalidResponse),/소모품/);
  }
});
test('페이지에 없는 장비도 서버 전체 합계로 계산하고 미정 무게를 보존한다',()=>{
  const currentBagResponse = createBagResponse();
  assert.equal(parseBagInventory(currentBagResponse).bag.knownWeightG,1600);
  assert.equal(parseBagInventory(currentBagResponse).bag.unknownWeightQuantity,3);
});
test('불완전하거나 불일치하는 합계를 거절한다',()=>{
  for(const currentBagPatch of [{knownWeightG:200},{unknownWeightQuantity:0},{capacityG:true},{items:[]},{knownWeightG:-1}]) {
    const currentBagResponse = createBagResponse();
    Object.assign(currentBagResponse.bag,currentBagPatch);
    assert.throws(()=>parseBagInventory(currentBagResponse),/가방/);
  }
  assert.throws(()=>parseBagInventory({...createBagResponse(),bag:undefined}),/가방/);
});
test('중복 재료와 잘못된 수량·무게를 거절한다',()=>{
  for(const currentMaterialPatch of [{quantity:0},{quantity:true},{weightG:-1},{kind:'equipment'}]) {
    const currentBagResponse=createBagResponse();Object.assign(currentBagResponse.bag.items[0],currentMaterialPatch);
    assert.throws(()=>parseBagInventory(currentBagResponse),/가방/);
  }
  const currentBagResponse=createBagResponse();currentBagResponse.bag.items.push(currentBagResponse.bag.items[0]);
  assert.throws(()=>parseBagInventory(currentBagResponse),/가방/);
});
test('판매 불가 스킬북 한 권의 무게를 합산한다',()=>{
  const currentBagResponse=createBagResponse();
  currentBagResponse.bag.items.push({id:'monster-lore-book',kind:'skillbook',quantity:1,nameTranslations:{ko:'몬스터학',en:'Monster Lore'},description:'책',weightG:450});
  currentBagResponse.bag.knownWeightG+=450;
  assert.equal(parseBagInventory(currentBagResponse).bag.knownWeightG,2050);
  currentBagResponse.bag.items.at(-1).quantity=2;
  assert.throws(()=>parseBagInventory(currentBagResponse),/스킬북/);
});

test('수집품과 등급 재료를 구분하고 잘못된 등급을 거절한다',()=>{
  const currentBagResponse=createBagResponse();
  currentBagResponse.bag.items[0].kind='collection';
  currentBagResponse.bag.items[1].kind='refined_material';
  currentBagResponse.bag.items[1].grade='high';
  assert.equal(parseBagInventory(currentBagResponse).bag.items[1].grade,'high');
  for(const invalidMaterialGrade of [undefined,'legendary',1]) {
    currentBagResponse.bag.items[1].grade=invalidMaterialGrade;
    assert.throws(()=>parseBagInventory(currentBagResponse),/등급/);
  }
  currentBagResponse.bag.items[1].grade='high';
  currentBagResponse.bag.items[0].grade='low';
  assert.throws(()=>parseBagInventory(currentBagResponse),/등급/);
});

function createPermitBagResponse() {
  const currentBagResponse = createBagResponse();
  currentBagResponse.travelerPermitSummary = {records:[{instanceId:'permit-one',itemId:'city-traveler-permit',
    characterId:'owner',cityId:'iseulon',cityName:'이슬온',issuerId:'moss-clearing-guard-center',issuedAt:100,expiresAt:604900,
    status:'VALID',quantity:1,weightG:null,nameTranslations:{ko:'여행자증명서',en:'Traveler Certificate'}}]};
  currentBagResponse.bag.unknownWeightQuantity++;
  return currentBagResponse;
}
test('여행자증명서는 개별 목록과 미정 무게 합계에 포함하며 만료 정각을 검증한다',()=>{
  const currentBagResponse = createPermitBagResponse();
  assert.equal(parseBagInventory(currentBagResponse,'owner').bag.unknownWeightQuantity,4);
  currentBagResponse.serverTime = 604900;
  assert.throws(()=>parseBagInventory(currentBagResponse,'owner'),/여행자증명서/);
  currentBagResponse.travelerPermitSummary.records[0].status = 'EXPIRED';
  assert.equal(parseBagInventory(currentBagResponse,'owner').travelerPermitSummary.records[0].status,'EXPIRED');
});
test('여행자증명서의 소유자·중복·기간·필드·무게 위조를 거절한다',()=>{
  for(const currentPermitPatch of [{characterId:'other'},{expiresAt:1000},{quantity:2},{weightG:0},{unknown:1},{issuedAt:true},{issuerId:''}]) {
    const currentBagResponse = createPermitBagResponse();
    Object.assign(currentBagResponse.travelerPermitSummary.records[0],currentPermitPatch);
    assert.throws(()=>parseBagInventory(currentBagResponse,'owner'),/여행자증명서/);
  }
  const currentBagResponse = createPermitBagResponse();
  currentBagResponse.travelerPermitSummary.records.push(currentBagResponse.travelerPermitSummary.records[0]);
  currentBagResponse.bag.unknownWeightQuantity++;
  assert.throws(()=>parseBagInventory(currentBagResponse,'owner'),/여행자증명서/);
});
test('생산 배치의 레벨과 고유 ID를 검증하며 구형 품목과 분리한다',()=>{
 const currentBagResponse=createBagResponse();
 const currentBatchItem={id:'production-batch:one',batchId:'one',definitionId:'gel-ration',kind:'consumable',itemLevel:2,performanceVersion:1,quantity:2,name:'젤 곡물식',nameTranslations:{ko:'젤 곡물식',en:'Gel Ration'},description:'식량',weightG:null};
 currentBagResponse.bag.items.push(currentBatchItem);currentBagResponse.bag.unknownWeightQuantity+=2;
 assert.equal(parseBagInventory(currentBagResponse).bag.items.at(-1).itemLevel,2);
 for(const currentInvalidPatch of [{itemLevel:3},{itemLevel:true},{performanceVersion:0},{batchId:'different'},{definitionId:undefined},{kind:'collection'}]){
  const currentInvalidResponse=structuredClone(currentBagResponse);Object.assign(currentInvalidResponse.bag.items.at(-1),currentInvalidPatch);
  assert.throws(()=>parseBagInventory(currentInvalidResponse),/생산 배치/);
 }
});
test('텍스트 가방도 생산 레벨을 표시하고 잘못된 배치를 거절한다',async()=>{
 const {formatCharacterBag}=await import('../scripts/text-client-core.mjs');
 const currentBatchItem={id:'production-batch:one',batchId:'one',definitionId:'gel-ration',kind:'consumable',itemLevel:2,performanceVersion:1,quantity:2,name:'젤 곡물식'};
 assert.match(formatCharacterBag({items:[currentBatchItem]}),/젤 곡물식 · Lv.2/);
 assert.throws(()=>formatCharacterBag({items:[{...currentBatchItem,itemLevel:3}]}),/생산 배치/);
});
test('생산 회복 배치도 고정 회복량과 배치 ID 사용 명령을 표시한다',async()=>{
 const {formatCharacterBag}=await import('../scripts/text-client-core.mjs');
 const currentBagResponse=createBagResponse();
 const currentBatchItem={id:'production-batch:chosen',batchId:'chosen',definitionId:'gel-ration',kind:'consumable',itemLevel:2,performanceVersion:1,quantity:2,name:'젤 곡물식',nameTranslations:{ko:'젤 곡물식',en:'Gel Ration'},description:'식량',weightG:null,useAction:{type:'RESTORE_HP',restorationHp:4,consumedOnSuccess:1}};
 currentBagResponse.bag.items.push(currentBatchItem);currentBagResponse.bag.unknownWeightQuantity+=2;
 assert.equal(parseBagInventory(currentBagResponse).bag.items.at(-1).useAction.restorationHp,4);
 assert.match(formatCharacterBag({items:[currentBatchItem]}),/HP 회복 4.*use-item production-batch:chosen/);
});


test('중간재 생산 배치는 레벨·개별 식별자를 표시하며 사용 명령을 허용하지 않는다',async()=>{
 const {formatCharacterBag}=await import('../scripts/text-client-core.mjs');
 const currentMaterialBatch={id:'production-batch:material-one',batchId:'material-one',definitionId:'leather-cord',kind:'material',itemLevel:1,performanceVersion:1,quantity:4,name:'표준 가죽끈',nameTranslations:{ko:'표준 가죽끈',en:'Leather Cord'},description:'제작 재료',weightG:null};
 const currentBagResponse=createBagResponse();
 currentBagResponse.bag.items.push(currentMaterialBatch);
 currentBagResponse.bag.unknownWeightQuantity+=4;
 assert.equal(parseBagInventory(currentBagResponse).bag.items.at(-1).batchId,'material-one');
 const currentTextResult=formatCharacterBag({items:[currentMaterialBatch]});
 assert.match(currentTextResult,/Lv\.1/);
 assert.match(currentTextResult,/production-batch:material-one/);
 assert.doesNotMatch(currentTextResult,/use-item|first-aid/);
 for(const currentInvalidFields of [{useAction:{type:'RESTORE_HP',restorationHp:3,consumedOnSuccess:1}},{itemLevel:3},{batchId:'other'},{performanceVersion:0},{kind:'refined_material'}]){
  const currentInvalidResponse=structuredClone(currentBagResponse);
  Object.assign(currentInvalidResponse.bag.items.at(-1),currentInvalidFields);
  assert.throws(()=>parseBagInventory(currentInvalidResponse));
  assert.throws(()=>formatCharacterBag({items:[{...currentMaterialBatch,...currentInvalidFields}]}));
 }
});
