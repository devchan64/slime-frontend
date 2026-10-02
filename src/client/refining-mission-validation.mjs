export const MISSION_REQUEST_ID_PATTERN=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function isMissionPositiveInteger(currentNumberValue){return Number.isSafeInteger(currentNumberValue)&&currentNumberValue>0;}
export function validateMissionRecord(currentMissionRecord,currentCharacterIdentifier){
 const currentMissionQuote=currentMissionRecord?.quote;
 const currentMissionDefinition=currentMissionQuote?.definitionSnapshot;
 const currentRefiningQuote=currentMissionQuote?.refining;
 if(!currentMissionRecord||currentMissionRecord.characterId!==currentCharacterIdentifier||!MISSION_REQUEST_ID_PATTERN.test(currentMissionRecord.requestId)
  ||!['ACTIVE','CANCELLED','COMPLETED'].includes(currentMissionRecord.status)||!Number.isFinite(currentMissionRecord.acceptedAt)||currentMissionRecord.acceptedAt<0
  ||!currentMissionDefinition||!['missionId','cityId','receiverNpcId','collectionId'].every(currentFieldName=>typeof currentMissionDefinition[currentFieldName]==='string'&&currentMissionDefinition[currentFieldName].trim())
  ||!isMissionPositiveInteger(currentMissionQuote.deposit?.depositP)||!isMissionPositiveInteger(currentMissionQuote.rewardP)
  ||!currentRefiningQuote||!isMissionPositiveInteger(currentRefiningQuote.inputQuantity)||!isMissionPositiveInteger(currentRefiningQuote.outputQuantity)
  ||!isMissionPositiveInteger(currentRefiningQuote.costP)||!isMissionPositiveInteger(currentRefiningQuote.durationSeconds)
  ||!['low','medium','high'].includes(currentRefiningQuote.grade)||typeof currentRefiningQuote.outputMaterial?.name!=='string'||!currentRefiningQuote.outputMaterial.name.trim()
  ||typeof currentRefiningQuote.outputMaterial.englishName!=='string'||!currentRefiningQuote.outputMaterial.englishName.trim()
  ||currentMissionDefinition.collectionId!==currentRefiningQuote.collectionId||currentMissionDefinition.grade!==currentRefiningQuote.grade
  ||currentMissionDefinition.quantity!==currentRefiningQuote.outputQuantity||currentMissionDefinition.rewardP!==currentMissionQuote.rewardP)throw new Error('정제 임무 기록이 올바르지 않습니다.');
 const currentTerminalField=currentMissionRecord.status==='CANCELLED'?'cancelledAt':currentMissionRecord.status==='COMPLETED'?'completedAt':null;
 for(const currentFieldName of ['cancelledAt','completedAt']){
  const currentTimestampValue=currentMissionRecord[currentFieldName];
  if(currentFieldName===currentTerminalField?(!Number.isFinite(currentTimestampValue)||currentTimestampValue<currentMissionRecord.acceptedAt):currentTimestampValue!=null)throw new Error('정제 임무 종료 시각이 올바르지 않습니다.');
 }
 return currentMissionRecord;
}
export function validateMissionPage(currentResponsePage,currentCharacterIdentifier,currentPageOffset=0){
 if(!currentResponsePage||!Number.isSafeInteger(currentResponsePage.characterVersion)||currentResponsePage.characterVersion<0||!Array.isArray(currentResponsePage.entries)||currentResponsePage.entries.length>50||!Number.isFinite(currentResponsePage.serverTime)||currentResponsePage.serverTime<0
  ||!(currentResponsePage.nextOffset===null||Number.isSafeInteger(currentResponsePage.nextOffset)&&currentResponsePage.nextOffset===currentPageOffset+50&&currentResponsePage.entries.length===50))throw new Error('정제 임무 목록 응답이 올바르지 않습니다.');
 const currentSeenIdentifiers=new Set();
 for(const currentMissionRecord of currentResponsePage.entries){
  validateMissionRecord(currentMissionRecord,currentCharacterIdentifier);
  if(currentSeenIdentifiers.has(currentMissionRecord.requestId))throw new Error('정제 임무가 중복되었습니다.');
  currentSeenIdentifiers.add(currentMissionRecord.requestId);
 }
 if(currentResponsePage.destinations!==undefined){
  const currentDestinationMap=currentResponsePage.destinations;
  if(!currentDestinationMap||typeof currentDestinationMap!=='object'||Array.isArray(currentDestinationMap)||Object.keys(currentDestinationMap).length!==currentSeenIdentifiers.size)throw new Error('정제 임무 목적지 목록이 올바르지 않습니다.');
  for(const currentRequestIdentifier of currentSeenIdentifiers){
   const currentDestinationEntry=currentDestinationMap[currentRequestIdentifier];
   if(!currentDestinationEntry||Object.keys(currentDestinationEntry).sort().join()!=='receiverCityNameTranslations,receiverName,refiningCityNameTranslations'||typeof currentDestinationEntry.receiverName!=='string'||!currentDestinationEntry.receiverName.trim())throw new Error('정제 임무 전달 NPC가 올바르지 않습니다.');
   for(const currentTranslationField of ['refiningCityNameTranslations','receiverCityNameTranslations']){
    const currentTranslationPair=currentDestinationEntry[currentTranslationField];
    if(!currentTranslationPair||Object.keys(currentTranslationPair).sort().join()!=='en,ko'||!['ko','en'].every(currentLanguageCode=>typeof currentTranslationPair[currentLanguageCode]==='string'&&currentTranslationPair[currentLanguageCode].trim()))throw new Error('정제 임무 도시 이름이 올바르지 않습니다.');
   }
  }
 }
 return currentResponsePage;
}

function compareMissionValues(currentFirstValue,currentSecondValue){
 if(currentFirstValue===currentSecondValue)return true;
 if(!currentFirstValue||!currentSecondValue||typeof currentFirstValue!=='object'||typeof currentSecondValue!=='object'||Array.isArray(currentFirstValue)!==Array.isArray(currentSecondValue))return false;
 const currentFirstKeys=Object.keys(currentFirstValue),currentSecondKeys=Object.keys(currentSecondValue);
 return currentFirstKeys.length===currentSecondKeys.length&&currentFirstKeys.every(currentFieldName=>Object.hasOwn(currentSecondValue,currentFieldName)&&compareMissionValues(currentFirstValue[currentFieldName],currentSecondValue[currentFieldName]));
}
export function validateMissionCancellation(currentReceiptValue,currentOriginalRecord,currentCharacterIdentifier){
 const currentReceiptRecord=validateMissionRecord(currentReceiptValue,currentCharacterIdentifier);
 if(currentReceiptRecord.requestId!==currentOriginalRecord.requestId||currentReceiptRecord.status!=='CANCELLED'||currentReceiptRecord.acceptedAt!==currentOriginalRecord.acceptedAt||!compareMissionValues(currentReceiptRecord.quote,currentOriginalRecord.quote))throw new Error('정제 임무 취소 영수증이 요청과 다릅니다.');
 return currentReceiptRecord;
}
