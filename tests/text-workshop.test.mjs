import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const CURRENT_INSTANCE_IDENTIFIER='11111111-1111-4111-8111-111111111111';
function createWorkshopState(){return {protocolVersion:1,generation:1,epoch:1,cursor:1,me:{id:'character',version:4,mode:'FIELD',position:{column:2,row:3}},map:{buildings:[{facilityId:'iseulon-workshop',facilityKind:'workshop',entrance:{column:2,row:3}}]}};}
function createWorkshopClient(currentResponseEntries){
 const currentRequestEntries=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestEntries.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length);
  return new Response(JSON.stringify(currentResponseEntries.shift()));
 }});
 currentTextClient.accept(createWorkshopState());return {currentTextClient,currentRequestEntries};
}
test('수리 견적의 전후 내구도와 개체 버전을 계약에 연결한다',async()=>{
 const currentRepairQuote={characterVersion:4,ownedCoins:10,quoteToken:'a'.repeat(64),materials:[],quote:{instanceId:CURRENT_INSTANCE_IDENTIFIER,instanceVersion:7,costP:2,durationSeconds:30,before:{currentDurability:20,maxDurability:80},after:{currentDurability:72,maxDurability:72}}};
 const {currentTextClient,currentRequestEntries}=createWorkshopClient([currentRepairQuote,{state:createWorkshopState()}]);
 assert.match(await currentTextClient.execute('workshop repair quote iseulon-workshop '+CURRENT_INSTANCE_IDENTIFIER),/20\/80 → 72\/72.*2p.*30초[\s\S]*취소 불가/);
 await assert.rejects(currentTextClient.execute('workshop craft create iseulon-workshop'),/견적/);
 await currentTextClient.execute('workshop repair create iseulon-workshop');
 assert.equal(currentRequestEntries[1].body.expectedInstanceVersion,7);
 assert.equal(currentRequestEntries[1].body.kind,'repair');
 assert.equal(currentRequestEntries[1].body.quantity,undefined);
});
test('수리 목록은 장착·예약·완전 수리 장비를 제외하고 다음 페이지를 안내한다',async()=>{
 const currentItemRecord={instanceId:CURRENT_INSTANCE_IDENTIFIER,definitionId:'iron-sword',definitionVersion:1,stateVersion:1,nameTranslations:{ko:'철검',en:'Sword'},description:'검',slot:'main_hand',equippedSlot:null,reserved:false,currentDurability:20,maxDurability:80,weightG:100,statBonus:{attackFlat:1,defenseFlat:0}};
 const currentInventoryPage={serverTime:100,characterVersion:4,knownEquipmentWeightG:400,nextCursor:CURRENT_INSTANCE_IDENTIFIER,slots:{},items:[currentItemRecord,...[{equippedSlot:'main_hand'},{reserved:true},{currentDurability:80}].map((currentItemPatch,currentItemIndex)=>({...currentItemRecord,...currentItemPatch,instanceId:String(currentItemIndex+2).repeat(8)+'-1111-4111-8111-111111111111'}))]};
 const {currentTextClient,currentRequestEntries}=createWorkshopClient([currentInventoryPage]);
 const currentOutputText=await currentTextClient.execute('workshop repair catalog iseulon-workshop '+CURRENT_INSTANCE_IDENTIFIER);
 assert.match(currentOutputText,/철검.*20\/80/);
 assert.equal(currentOutputText.split('\n').length,2);
 assert.match(currentOutputText,/다음커서:/);
 assert.ok(currentRequestEntries[0].url.endsWith('?after='+CURRENT_INSTANCE_IDENTIFIER));
});
