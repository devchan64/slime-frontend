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
 const currentListingRecord={characterVersion:4,serverTime:100,nextCursor:null,entries:[{parcelId:CURRENT_PARCEL_IDENTIFIER,sentAt:90,expiresAt:200,attachmentNames:[null,{ko:'기본 의상',en:'Default outfit'},{ko:'단백질 젤리',en:'Protein jelly'}],attachments:[{kind:'money',amountP:7},{kind:'costume',costumeId:'default'},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}]}]};
 const {currentTextClient,currentRequestEntries}=createParcelClient([currentListingRecord]);
 assert.match(await currentTextClient.execute('parcels list iseulon-guild '+CURRENT_PARCEL_IDENTIFIER),/7p.*코스튬 기본 의상.*단백질 젤리 × 2.*만료/);
 assert.ok(currentRequestEntries[0].url.endsWith('?includeNames=true&after='+CURRENT_PARCEL_IDENTIFIER));
 assert.match(formatParcelListing(currentListingRecord,'en'),/Default outfit.*Protein jelly/);
 for(const currentAttachmentNames of [[],[null,null,null],[null,{ko:'기본 의상'}, {ko:'젤리',en:'Jelly'}]])assert.throws(()=>formatParcelListing({...currentListingRecord,entries:[{...currentListingRecord.entries[0],attachmentNames:currentAttachmentNames}]},'ko'));
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

test('확인한 소포와 다른 금액·수량·종류·누락 영수증을 거절한다',async()=>{
 const {validateParcelReceipt}=await import('../src/client/parcel-validation.mjs');
 const currentExpectedAttachments=[{kind:'money',amountP:7},{kind:'item',category:'material',itemId:'protein-jelly',quantity:2}];
 const currentReceiptRecord={...createParcelReceipt(),attachments:currentExpectedAttachments};
 assert.equal(validateParcelReceipt({...currentReceiptRecord,attachments:[...currentExpectedAttachments].reverse()},CURRENT_PARCEL_IDENTIFIER,'character',currentExpectedAttachments).parcelId,CURRENT_PARCEL_IDENTIFIER);
 for(const currentChangedAttachments of [
  [{kind:'money',amountP:8},currentExpectedAttachments[1]],
  [currentExpectedAttachments[0],{...currentExpectedAttachments[1],quantity:3}],
  [currentExpectedAttachments[0],{...currentExpectedAttachments[1],category:'consumable'}],
  [currentExpectedAttachments[0]],
 ])assert.throws(()=>validateParcelReceipt({...currentReceiptRecord,attachments:currentChangedAttachments},CURRENT_PARCEL_IDENTIFIER,'character',currentExpectedAttachments));
});

test('조회한 첨부물은 수령 응답 검증과 재시도에 고정한다',async()=>{
 const currentListingRecord={characterVersion:4,serverTime:100,nextCursor:null,entries:[{parcelId:CURRENT_PARCEL_IDENTIFIER,sentAt:90,expiresAt:200,attachmentNames:[null],attachments:[{kind:'money',amountP:7}]}]};
 const currentWrongReceipt={state:{...createParcelState(),cursor:2},receipt:{...createParcelReceipt(),attachments:[{kind:'money',amountP:70}]}};
 const {currentTextClient,currentRequestEntries}=createParcelClient([currentListingRecord,currentWrongReceipt,currentWrongReceipt,{state:{...createParcelState(),cursor:2},receipt:createParcelReceipt()}]);
 await currentTextClient.execute('parcels list iseulon-guild');
 await assert.rejects(()=>currentTextClient.execute('parcels claim iseulon-guild '+CURRENT_PARCEL_IDENTIFIER),/retry/);
 assert.equal(currentTextClient.state.cursor,1);
 assert.ok(currentTextClient.pendingCommandRequest);
 assert.match(await currentTextClient.execute('retry'),/수령 완료.*7p/);
 assert.deepEqual(currentRequestEntries.slice(1).map(currentRequestEntry=>currentRequestEntry.body),Array(3).fill({expectedVersion:4}));
});

test('조회 도중 세션이 바뀌면 이전 소포 목록을 표시하거나 캐시하지 않는다',async()=>{
 let completeListingResponse;
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:()=>new Promise(currentResolveCallback=>{completeListingResponse=currentResolveCallback;})});
 currentTextClient.accept(createParcelState());
 const currentPendingListing=currentTextClient.execute('parcels list iseulon-guild');
 currentTextClient.accept({...createParcelState(),generation:2});
 completeListingResponse(new Response(JSON.stringify({characterVersion:4,serverTime:100,nextCursor:null,entries:[]})));
 await assert.rejects(()=>currentPendingListing,/세션·위치/);
 assert.equal(currentTextClient.parcelListingReceiptContext,null);
});
