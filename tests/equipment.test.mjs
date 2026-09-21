import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const equipmentModuleBuild = await build({entryPoints:['src/client/equipment.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseEquipmentInventory,mergeEquipmentInventoryPages} = await import(`data:text/javascript;base64,${Buffer.from(equipmentModuleBuild.outputFiles[0].text).toString('base64')}`);
function createEquipmentResponse() {
  return {serverTime:100,characterVersion:2,knownEquipmentWeightG:1400,nextCursor:null,slots:{},items:[{
    instanceId:'00000000-0000-0000-0000-000000000001',definitionId:'iron-sword',definitionVersion:1,stateVersion:1,
    nameTranslations:{ko:'철검',en:'Iron Sword'},description:'철검 설명',slot:'main_hand',equippedSlot:null,reserved:false,
    currentDurability:80,maxDurability:80,weightG:1400,statBonus:{attackFlat:2,defenseFlat:0},
  }]};
}
test('장착 목록과 내구도 0을 그대로 보존한다',()=>{
  const currentInventoryPage = createEquipmentResponse();
  currentInventoryPage.items[0].currentDurability=0;
  currentInventoryPage.items[0].equippedSlot='main_hand';
  currentInventoryPage.slots.main_hand=structuredClone(currentInventoryPage.items[0]);
  assert.deepEqual(parseEquipmentInventory(currentInventoryPage),currentInventoryPage);
});
test('잘못된 내구도·버전·무게·번역·슬롯·예약을 거절한다',()=>{
  for(const invalidInstancePatch of [{currentDurability:81},{maxDurability:-1},{weightG:true},{stateVersion:0},
    {definitionVersion:1.5},{nameTranslations:{ko:'철검'}},{equippedSlot:'feet'},
    {reserved:true,equippedSlot:'main_hand'},{statBonus:{attackFlat:-1,defenseFlat:0}},{slot:'unknown'}]) {
    const currentInventoryPage=createEquipmentResponse();
    Object.assign(currentInventoryPage.items[0],invalidInstancePatch);
    assert.throws(()=>parseEquipmentInventory(currentInventoryPage),/장비/);
  }
});
test('중복 ID와 잘못된 페이지·슬롯 참조를 거절한다',()=>{
  const currentInventoryPage=createEquipmentResponse();
  currentInventoryPage.items.push(structuredClone(currentInventoryPage.items[0]));
  assert.throws(()=>parseEquipmentInventory(currentInventoryPage),/중복/);
  for(const invalidPagePatch of [{serverTime:NaN},{characterVersion:true},{knownEquipmentWeightG:-1},{nextCursor:'bad'},
    {slots:[]},{items:null},{slots:{feet:createEquipmentResponse().items[0]}}]) {
    assert.throws(()=>parseEquipmentInventory({...createEquipmentResponse(),...invalidPagePatch}),/장비|장착/);
  }
});

test('장비 페이지는 같은 버전과 요청 커서에서만 합치고 원본을 보존한다', () => {
  const previousInventoryPage = createEquipmentResponse();
  previousInventoryPage.nextCursor = previousInventoryPage.items[0].instanceId;
  const receivedInventoryPage = createEquipmentResponse();
  receivedInventoryPage.items[0].instanceId = '00000000-0000-0000-0000-000000000002';
  const mergedInventoryPage = mergeEquipmentInventoryPages(previousInventoryPage, receivedInventoryPage, previousInventoryPage.nextCursor);
  assert.equal(mergedInventoryPage.items.length, 2);
  assert.equal(mergedInventoryPage.nextCursor, null);
  assert.equal(previousInventoryPage.items.length, 1);
  assert.equal(receivedInventoryPage.items.length, 1);
  assert.equal(mergeEquipmentInventoryPages(previousInventoryPage, receivedInventoryPage), receivedInventoryPage);
});

test('페이지 간 상태 변경·중복·잘못된 커서·첫 페이지 누락은 합치지 않는다', () => {
  const previousInventoryPage = createEquipmentResponse();
  previousInventoryPage.nextCursor = previousInventoryPage.items[0].instanceId;
  const receivedInventoryPage = createEquipmentResponse();
  const requestedPageCursor = previousInventoryPage.nextCursor;
  assert.throws(() => mergeEquipmentInventoryPages(previousInventoryPage, receivedInventoryPage, requestedPageCursor), {key:'equipment.inventoryChanged'});
  receivedInventoryPage.items[0].instanceId = '00000000-0000-0000-0000-000000000002';
  receivedInventoryPage.characterVersion++;
  assert.throws(() => mergeEquipmentInventoryPages(previousInventoryPage, receivedInventoryPage, requestedPageCursor), {key:'equipment.inventoryChanged'});
  receivedInventoryPage.characterVersion--;
  assert.throws(() => mergeEquipmentInventoryPages(previousInventoryPage, receivedInventoryPage, receivedInventoryPage.items[0].instanceId), {key:'equipment.inventoryChanged'});
  assert.throws(() => mergeEquipmentInventoryPages(null, receivedInventoryPage, requestedPageCursor), {key:'equipment.inventoryChanged'});
});
