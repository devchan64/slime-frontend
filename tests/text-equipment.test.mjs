import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const CURRENT_INSTANCE_IDENTIFIER='11111111-1111-4111-8111-111111111111';
function createEquipmentState(currentCharacterVersion=4){return {protocolVersion:1,generation:1,epoch:1,cursor:currentCharacterVersion,me:{id:'character',version:currentCharacterVersion,mode:'FIELD'}};}
function createEquipmentPage(){return {characterVersion:4,serverTime:100,knownEquipmentWeightG:100,nextCursor:null,slots:{},items:[{instanceId:CURRENT_INSTANCE_IDENTIFIER,definitionId:'iron-sword',definitionVersion:1,stateVersion:7,nameTranslations:{ko:'철검',en:'Sword'},description:'검',slot:'main_hand',equippedSlot:null,reserved:false,currentDurability:20,maxDurability:80,weightG:100,statBonus:{attackFlat:1,defenseFlat:0}}]};}
function createEquipmentClient(currentResponseEntries){
 const currentRequestEntries=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestEntries.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length);
  const currentResponseRecord=currentResponseEntries.shift();
  if(currentResponseRecord instanceof Error)throw currentResponseRecord;
  return new Response(JSON.stringify(currentResponseRecord));
 }});
 currentTextClient.accept(createEquipmentState());return {currentTextClient,currentRequestEntries};
}
test('장착 영수증 후 상태 조회만 실패하면 명령을 재전송하지 않는다',async()=>{
 const currentReceiptRecord={slot:'main_hand',instanceId:CURRENT_INSTANCE_IDENTIFIER,instanceVersion:8,changed:true,characterVersion:5};
 const {currentTextClient,currentRequestEntries}=createEquipmentClient([createEquipmentPage(),currentReceiptRecord,new TypeError('상태 유실'),new TypeError('상태 유실'),createEquipmentState(5)]);
 assert.match(await currentTextClient.execute('equipment list'),/철검.*20\/80.*미장착/);
 await assert.rejects(currentTextClient.execute('equipment equip '+CURRENT_INSTANCE_IDENTIFIER),/retry/);
 assert.equal(currentTextClient.state.me.version,4);
 assert.match(await currentTextClient.execute('retry'),/장비 변경 완료/);
 assert.equal(currentTextClient.state.me.version,5);
 assert.equal(currentRequestEntries.filter(currentRequestEntry=>currentRequestEntry.body).length,1);
 assert.equal(currentRequestEntries[1].body.expectedInstanceVersion,7);
});
test('잘못된 영수증은 적용하지 않으며 원래 명령을 재전송한다',async()=>{
 const currentWrongReceipt={slot:'body',instanceId:CURRENT_INSTANCE_IDENTIFIER,instanceVersion:8,changed:true,characterVersion:5};
 const {currentTextClient,currentRequestEntries}=createEquipmentClient([createEquipmentPage(),currentWrongReceipt,currentWrongReceipt,{...currentWrongReceipt,slot:'main_hand'},createEquipmentState(5)]);
 await currentTextClient.execute('equipment list');
 await assert.rejects(currentTextClient.execute('equipment equip '+CURRENT_INSTANCE_IDENTIFIER),/retry/);
 await currentTextClient.execute('retry');
 assert.deepEqual(currentRequestEntries[1],currentRequestEntries[2]);
 assert.deepEqual(currentRequestEntries[2],currentRequestEntries[3]);
});
test('슬롯 해제는 개체와 개체 버전을 null로 전송한다',async()=>{
 const {currentTextClient,currentRequestEntries}=createEquipmentClient([createEquipmentPage(),{slot:'main_hand',instanceId:null,instanceVersion:null,changed:false,characterVersion:4},createEquipmentState()]);
 await currentTextClient.execute('equipment list');
 await currentTextClient.execute('equipment unequip main_hand');
 assert.equal(currentRequestEntries[1].body.instanceId,null);
 assert.equal(currentRequestEntries[1].body.expectedInstanceVersion,null);
});
test('이전 버전 목록과 예약 중 장비는 장착하지 않는다',async()=>{
 const currentReservedPage=createEquipmentPage();currentReservedPage.items[0].reserved=true;
 const {currentTextClient,currentRequestEntries}=createEquipmentClient([currentReservedPage]);
 await currentTextClient.execute('equipment list');
 await assert.rejects(currentTextClient.execute('equipment equip '+CURRENT_INSTANCE_IDENTIFIER),/예약/);
 currentTextClient.accept(createEquipmentState(5));
 await assert.rejects(currentTextClient.execute('equipment unequip main_hand'),/먼저 조회/);
 assert.equal(currentRequestEntries.length,1);
});
