import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
import {formatParcelListing} from '../scripts/text-parcel-commands.mjs';
const CURRENT_PARCEL_IDENTIFIER='11111111-1111-4111-8111-111111111111';
function createParcelState(){return {protocolVersion:1,generation:1,epoch:1,cursor:1,me:{id:'character',version:4,mode:'FIELD',position:{column:2,row:3}},map:{buildings:[{facilityId:'iseulon-guild',facilityKind:'guild',entrance:{column:2,row:3}}]}};}
function createParcelReceipt(){return {parcelId:CURRENT_PARCEL_IDENTIFIER,characterId:'character',facilityId:'iseulon-guild',claimedAt:120,attachments:[{kind:'money',amountP:7}]};}
function createParcelClient(currentResponseEntries){
 const currentRequestEntries=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestEntries.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseEntries.length,'예상하지 않은 요청');
  const currentResponseRecord=currentResponseEntries.shift();
  if(currentResponseRecord instanceof Error)throw currentResponseRecord;
  return new Response(JSON.stringify(currentResponseRecord));
 }});
 currentTextClient.accept(createParcelState());
 return {currentTextClient,currentRequestEntries};
}
test('소포 첨부와 만료를 표시하고 목록 커서를 전송한다',async()=>{
 const currentListingRecord={characterVersion:4,serverTime:100,nextCursor:null,entries:[{parcelId:CURRENT_PARCEL_IDENTIFIER,sentAt:90,expiresAt:200,attachments:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]}]};
 const {currentTextClient,currentRequestEntries}=createParcelClient([currentListingRecord]);
 assert.match(await currentTextClient.execute('parcels list iseulon-guild '+CURRENT_PARCEL_IDENTIFIER),/7p.*코스튬 default.*protein-jelly × 2.*만료/);
 assert.ok(currentRequestEntries[0].url.endsWith('?after='+CURRENT_PARCEL_IDENTIFIER));
 for(const currentInvalidPatch of [{serverTime:200},{nextCursor:CURRENT_PARCEL_IDENTIFIER},{entries:[...currentListingRecord.entries,...currentListingRecord.entries]}])assert.throws(()=>formatParcelListing({...currentListingRecord,...currentInvalidPatch}));
});
test('응답 유실과 잘못된 영수증은 같은 소포·버전으로 retry한다',async()=>{
 const {currentTextClient,currentRequestEntries}=createParcelClient([new TypeError('응답 유실'),{state:createParcelState(),receipt:{...createParcelReceipt(),characterId:'other'}},{state:{...createParcelState(),cursor:2},receipt:createParcelReceipt()}]);
 await assert.rejects(()=>currentTextClient.execute('parcels claim iseulon-guild '+CURRENT_PARCEL_IDENTIFIER),/retry/);
 assert.ok(currentTextClient.pendingCommandRequest);
 assert.equal(currentTextClient.state.cursor,1);
 assert.match(await currentTextClient.execute('retry'),/수령 완료.*7p/);
 assert.deepEqual(currentRequestEntries.map(currentRequestEntry=>currentRequestEntry.body),Array(3).fill({expectedVersion:4}));
 assert.equal(new Set(currentRequestEntries.map(currentRequestEntry=>currentRequestEntry.url)).size,1);
 assert.equal(currentTextClient.pendingCommandRequest,null);
});
test('길드 외부·잘못된 명령·소포 ID는 요청 전에 거절한다',async()=>{
 const {currentTextClient,currentRequestEntries}=createParcelClient([]);
 for(const currentInvalidCommand of ['parcels claim iseulon-guild','parcels list ../guild','parcels claim iseulon-guild invalid','parcels send iseulon-guild'])await assert.rejects(()=>currentTextClient.execute(currentInvalidCommand));
 currentTextClient.state.me.position.column=0;
 await assert.rejects(()=>currentTextClient.execute('parcels list iseulon-guild'),/입구/);
 assert.equal(currentRequestEntries.length,0);
});
