import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild = await build({entryPoints:['src/client/bag.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseBagInventory} = await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function createBagResponse() {
  return {serverTime:100,characterVersion:2,knownEquipmentWeightG:1400,nextCursor:null,slots:{},items:[],bag:{capacityG:20000,knownWeightG:1600,unknownWeightQuantity:3,items:[
    {id:'protein-jelly',kind:'material',quantity:2,nameTranslations:{ko:'젤리',en:'Jelly'},description:'재료',weightG:100,valueP:1},
    {id:'iron-ore',kind:'material',quantity:3,nameTranslations:{ko:'철광석',en:'Iron ore'},description:'재료',weightG:null,valueP:null},
  ]}};
}
test('붕대 소모품의 수량과 미정 무게도 가방 합계에 포함한다',()=>{
  const currentBagResponse=createBagResponse();
  currentBagResponse.bag.items.push({id:'clean-bandage',kind:'consumable',quantity:2,nameTranslations:{ko:'깨끗한 붕대',en:'Clean Bandage'},description:'응급처치 재료',weightG:null,valueP:10});
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
  for(const currentMaterialPatch of [{quantity:0},{quantity:true},{weightG:-1},{kind:'equipment'},{valueP:0}]) {
    const currentBagResponse=createBagResponse();Object.assign(currentBagResponse.bag.items[0],currentMaterialPatch);
    assert.throws(()=>parseBagInventory(currentBagResponse),/가방/);
  }
  const currentBagResponse=createBagResponse();currentBagResponse.bag.items.push(currentBagResponse.bag.items[0]);
  assert.throws(()=>parseBagInventory(currentBagResponse),/가방/);
});
