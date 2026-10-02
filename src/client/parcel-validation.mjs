// 소포는 계정 보관함에서 조회하며 소포 ID 자체를 수령 재시도 키로 사용한다.
const PARCEL_IDENTIFIER_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PARCEL_FACILITY_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const PARCEL_ITEM_CATEGORIES=new Set(['material','collection','refined_material','consumable','equipment','skillbook']);
function requireParcelCondition(currentConditionValue){if(!currentConditionValue)throw new Error('소포 응답 형식이 올바르지 않습니다.');}
export function validateParcelAttachments(currentAttachmentEntries){
 requireParcelCondition(Array.isArray(currentAttachmentEntries)&&currentAttachmentEntries.length>0);
 return currentAttachmentEntries.map(currentAttachmentRecord=>{
  requireParcelCondition(currentAttachmentRecord&&typeof currentAttachmentRecord==='object');
  if(currentAttachmentRecord.kind==='money'){
   requireParcelCondition(Object.keys(currentAttachmentRecord).sort().join(',')==='amountP,kind'&&Number.isSafeInteger(currentAttachmentRecord.amountP)&&currentAttachmentRecord.amountP>0);
   return currentAttachmentRecord.amountP+'P';
  }
  if(currentAttachmentRecord.kind==='costume'){
   requireParcelCondition(Object.keys(currentAttachmentRecord).sort().join(',')==='costumeId,kind'&&typeof currentAttachmentRecord.costumeId==='string'&&/^[a-zA-Z0-9_-]+$/.test(currentAttachmentRecord.costumeId));
   return '코스튬 '+currentAttachmentRecord.costumeId;
  }
  requireParcelCondition(Object.keys(currentAttachmentRecord).sort().join(',')==='category,itemId,kind,quantity'&&currentAttachmentRecord.kind==='item'&&PARCEL_ITEM_CATEGORIES.has(currentAttachmentRecord.category)&&typeof currentAttachmentRecord.itemId==='string'&&/^[a-zA-Z0-9_-]+$/.test(currentAttachmentRecord.itemId)&&Number.isSafeInteger(currentAttachmentRecord.quantity)&&currentAttachmentRecord.quantity>0);
  return currentAttachmentRecord.itemId+' × '+currentAttachmentRecord.quantity;
 });
}
export function formatParcelListing(currentListingRecord,currentNameLocale=null){
 if(currentNameLocale!==null){requireParcelCondition(['ko','en'].includes(currentNameLocale));validateNamedParcelListing(currentListingRecord);}
 requireParcelCondition(currentListingRecord&&Number.isSafeInteger(currentListingRecord.characterVersion)&&currentListingRecord.characterVersion>=0&&Number.isFinite(currentListingRecord.serverTime)&&currentListingRecord.serverTime>=0&&Array.isArray(currentListingRecord.entries)&&currentListingRecord.entries.length<=100&&(currentListingRecord.nextCursor===null||PARCEL_IDENTIFIER_PATTERN.test(currentListingRecord.nextCursor)));
 const currentSeenIdentifiers=new Set();
 const currentOutputLines=currentListingRecord.entries.map(currentParcelRecord=>{
  requireParcelCondition(currentParcelRecord&&PARCEL_IDENTIFIER_PATTERN.test(currentParcelRecord.parcelId)&&!currentSeenIdentifiers.has(currentParcelRecord.parcelId)&&Number.isFinite(currentParcelRecord.sentAt)&&currentParcelRecord.sentAt>=0&&Number.isFinite(currentParcelRecord.expiresAt)&&currentParcelRecord.expiresAt>Math.max(currentParcelRecord.sentAt,currentListingRecord.serverTime));
  currentSeenIdentifiers.add(currentParcelRecord.parcelId);
  const currentExpiryDate=new Date(currentParcelRecord.expiresAt*1000);
  requireParcelCondition(Number.isFinite(currentExpiryDate.getTime()));
  const currentAttachmentLabels=validateParcelAttachments(currentParcelRecord.attachments).map((currentOriginalLabel,currentAttachmentIndex)=>{
   if(currentNameLocale===null)return currentOriginalLabel;
   const currentAttachmentRecord=currentParcelRecord.attachments[currentAttachmentIndex];
   if(currentAttachmentRecord.kind==='money')return currentOriginalLabel;
   const currentDisplayName=currentParcelRecord.attachmentNames[currentAttachmentIndex][currentNameLocale];
   return currentAttachmentRecord.kind==='costume'?'코스튬 '+currentDisplayName:currentDisplayName+' × '+currentAttachmentRecord.quantity;
  });
  return currentParcelRecord.parcelId+' · '+currentAttachmentLabels.join(', ')+' · 만료 '+currentExpiryDate.toISOString();
 });
 requireParcelCondition(currentListingRecord.nextCursor===null||(currentListingRecord.entries.length===100&&currentListingRecord.nextCursor===currentListingRecord.entries.at(-1).parcelId));
 return (currentOutputLines.join('\n')||'수령 가능한 소포가 없습니다.')+(currentListingRecord.nextCursor?'\n다음 커서: '+currentListingRecord.nextCursor:'');
}

export function validateParcelListing(currentListingRecord){formatParcelListing(currentListingRecord);return currentListingRecord;}
export function validateParcelReceipt(currentReceiptRecord,currentParcelIdentifier,currentCharacterIdentifier,currentExpectedAttachments){
 requireParcelCondition(currentReceiptRecord&&currentReceiptRecord.parcelId===currentParcelIdentifier&&currentReceiptRecord.characterId===currentCharacterIdentifier&&PARCEL_FACILITY_PATTERN.test(currentReceiptRecord.facilityId)&&Number.isFinite(currentReceiptRecord.claimedAt)&&currentReceiptRecord.claimedAt>=0);
 validateParcelAttachments(currentReceiptRecord.attachments);
 if(currentExpectedAttachments!==undefined){
  validateParcelAttachments(currentExpectedAttachments);
  const canonicalizeParcelAttachments=currentAttachmentEntries=>JSON.stringify(currentAttachmentEntries.map(currentAttachmentRecord=>
   JSON.stringify(Object.keys(currentAttachmentRecord).sort().map(currentFieldName=>[currentFieldName,currentAttachmentRecord[currentFieldName]]))).sort());
  requireParcelCondition(canonicalizeParcelAttachments(currentReceiptRecord.attachments)===canonicalizeParcelAttachments(currentExpectedAttachments));
 }
 return currentReceiptRecord;
}


export function validateNamedParcelListing(currentListingRecord){
 validateParcelListing(currentListingRecord);
 for(const currentParcelRecord of currentListingRecord.entries){
  requireParcelCondition(Array.isArray(currentParcelRecord.attachmentNames)&&currentParcelRecord.attachmentNames.length===currentParcelRecord.attachments.length);
  currentParcelRecord.attachmentNames.forEach((currentNameRecord,currentAttachmentIndex)=>{
   if(currentParcelRecord.attachments[currentAttachmentIndex].kind==='money'){requireParcelCondition(currentNameRecord===null);return;}
   requireParcelCondition(currentNameRecord&&Object.keys(currentNameRecord).sort().join(',')==='en,ko'&&['ko','en'].every(currentLocaleCode=>typeof currentNameRecord[currentLocaleCode]==='string'&&currentNameRecord[currentLocaleCode].trim().length>0));
  });
 }
 return currentListingRecord;
}
