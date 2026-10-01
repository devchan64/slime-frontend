// 소포는 길드 현장에서 조회하며 소포 ID 자체를 수령 재시도 키로 사용한다.
const PARCEL_IDENTIFIER_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PARCEL_FACILITY_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const PARCEL_ITEM_CATEGORIES=new Set(['material','collection','refined_material','consumable','equipment','skillbook']);
function requireParcelCondition(currentConditionValue){if(!currentConditionValue)throw new Error('소포 응답 형식이 올바르지 않습니다.');}
function validateParcelAttachments(currentAttachmentEntries){
 requireParcelCondition(Array.isArray(currentAttachmentEntries)&&currentAttachmentEntries.length>0);
 return currentAttachmentEntries.map(currentAttachmentRecord=>{
  requireParcelCondition(currentAttachmentRecord&&typeof currentAttachmentRecord==='object');
  if(currentAttachmentRecord.kind==='money'){
   requireParcelCondition(Object.keys(currentAttachmentRecord).sort().join(',')==='amountP,kind'&&Number.isSafeInteger(currentAttachmentRecord.amountP)&&currentAttachmentRecord.amountP>0);
   return currentAttachmentRecord.amountP+'p';
  }
  if(currentAttachmentRecord.kind==='costume'){
   requireParcelCondition(Object.keys(currentAttachmentRecord).sort().join(',')==='costumeId,kind'&&typeof currentAttachmentRecord.costumeId==='string'&&/^[a-zA-Z0-9_-]+$/.test(currentAttachmentRecord.costumeId));
   return '코스튬 '+currentAttachmentRecord.costumeId;
  }
  requireParcelCondition(Object.keys(currentAttachmentRecord).sort().join(',')==='category,itemId,kind,quantity'&&currentAttachmentRecord.kind==='item'&&PARCEL_ITEM_CATEGORIES.has(currentAttachmentRecord.category)&&typeof currentAttachmentRecord.itemId==='string'&&/^[a-zA-Z0-9_-]+$/.test(currentAttachmentRecord.itemId)&&Number.isSafeInteger(currentAttachmentRecord.quantity)&&currentAttachmentRecord.quantity>0);
  return currentAttachmentRecord.itemId+' × '+currentAttachmentRecord.quantity;
 });
}
export function formatParcelListing(currentListingRecord){
 requireParcelCondition(currentListingRecord&&Number.isSafeInteger(currentListingRecord.characterVersion)&&currentListingRecord.characterVersion>=0&&Number.isFinite(currentListingRecord.serverTime)&&currentListingRecord.serverTime>=0&&Array.isArray(currentListingRecord.entries)&&currentListingRecord.entries.length<=100&&(currentListingRecord.nextCursor===null||PARCEL_IDENTIFIER_PATTERN.test(currentListingRecord.nextCursor)));
 const currentSeenIdentifiers=new Set();
 const currentOutputLines=currentListingRecord.entries.map(currentParcelRecord=>{
  requireParcelCondition(currentParcelRecord&&PARCEL_IDENTIFIER_PATTERN.test(currentParcelRecord.parcelId)&&!currentSeenIdentifiers.has(currentParcelRecord.parcelId)&&Number.isFinite(currentParcelRecord.sentAt)&&currentParcelRecord.sentAt>=0&&Number.isFinite(currentParcelRecord.expiresAt)&&currentParcelRecord.expiresAt>Math.max(currentParcelRecord.sentAt,currentListingRecord.serverTime));
  currentSeenIdentifiers.add(currentParcelRecord.parcelId);
  const currentExpiryDate=new Date(currentParcelRecord.expiresAt*1000);
  requireParcelCondition(Number.isFinite(currentExpiryDate.getTime()));
  return currentParcelRecord.parcelId+' · '+validateParcelAttachments(currentParcelRecord.attachments).join(', ')+' · 만료 '+currentExpiryDate.toISOString();
 });
 requireParcelCondition(currentListingRecord.nextCursor===null||(currentListingRecord.entries.length===100&&currentListingRecord.nextCursor===currentListingRecord.entries.at(-1).parcelId));
 return (currentOutputLines.join('\n')||'수령 가능한 소포가 없습니다.')+(currentListingRecord.nextCursor?'\n다음 커서: '+currentListingRecord.nextCursor:'');
}
export async function executeParcelCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentFacilityIdentifier,currentParcelIdentifier]=currentCommandArguments;
 if(!['list','claim'].includes(currentActionName)||!PARCEL_FACILITY_PATTERN.test(currentFacilityIdentifier??'')||currentCommandArguments.length<2||currentCommandArguments.length>3||(currentActionName==='claim'&&!currentParcelIdentifier)||(currentParcelIdentifier&&!PARCEL_IDENTIFIER_PATTERN.test(currentParcelIdentifier)))throw new Error('parcels list 길드ID [다음커서] / parcels claim 길드ID 소포ID로 입력하세요.');
 const currentGameState=currentTextClient.state;
 const currentGuildEntry=currentGameState?.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityKind==='guild'&&currentBuildingEntry.facilityId===currentFacilityIdentifier);
 if(!currentGuildEntry||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation||currentGameState.me.position?.column!==currentGuildEntry.entrance?.column||currentGameState.me.position?.row!==currentGuildEntry.entrance?.row)throw new Error('전투·조우를 종료하고 해당 길드회관 입구로 이동하세요.');
 const currentEndpointPrefix='/v1/game/guilds/'+currentFacilityIdentifier+'/parcels';
 if(currentActionName==='list')return formatParcelListing(await currentTextClient.request(currentEndpointPrefix+(currentParcelIdentifier?'?after='+currentParcelIdentifier:'')));
 const currentCharacterIdentifier=currentGameState.me.id;
 return currentTextClient.command(currentEndpointPrefix+'/'+currentParcelIdentifier+'/claim',{},currentCommandResult=>'소포 수령 완료: '+currentCommandResult.receipt.parcelId+' · '+validateParcelAttachments(currentCommandResult.receipt.attachments).join(', '),{
  includeRequestIdentifier:false,
  validateCommandResponse(currentCommandResult){
   const currentReceiptRecord=currentCommandResult?.receipt;
   requireParcelCondition(currentReceiptRecord&&currentReceiptRecord.parcelId===currentParcelIdentifier&&currentReceiptRecord.characterId===currentCharacterIdentifier&&PARCEL_FACILITY_PATTERN.test(currentReceiptRecord.facilityId)&&Number.isFinite(currentReceiptRecord.claimedAt)&&currentReceiptRecord.claimedAt>=0);
   validateParcelAttachments(currentReceiptRecord.attachments);
  }
 });
}
