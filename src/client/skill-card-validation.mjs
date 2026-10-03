// 카드 정의·보관 상태·영수증을 검증한 다음에만 클라이언트 상태에 적용한다.
const SKILL_CARD_ID_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const SKILL_CARD_UUID_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
function requireCardResponseCondition(currentConditionValue){if(!currentConditionValue)throw new Error('스킬카드 응답 형식이 올바르지 않습니다.');}
export function parseSkillCardInventory(currentResponseValue){
 requireCardResponseCondition(currentResponseValue&&Number.isSafeInteger(currentResponseValue.characterVersion)&&currentResponseValue.characterVersion>=0
  &&Array.isArray(currentResponseValue.cards)&&(currentResponseValue.catalog===undefined||Array.isArray(currentResponseValue.catalog)));
 for(const currentEntryCollection of [currentResponseValue.cards,currentResponseValue.catalog??[]]){
  const currentSeenIdentifiers=new Set();
  for(const currentCardEntry of currentEntryCollection){
   requireCardResponseCondition(currentCardEntry&&typeof currentCardEntry.cardId==='string'&&SKILL_CARD_ID_PATTERN.test(currentCardEntry.cardId)
    &&!currentSeenIdentifiers.has(currentCardEntry.cardId)&&[currentCardEntry.definitionVersion,currentCardEntry.literacyRequired].every(currentNumericValue=>Number.isSafeInteger(currentNumericValue)&&currentNumericValue>=1)
    &&typeof currentCardEntry.grantsSkill==='string'&&/^[a-z][a-z0-9_]*$/.test(currentCardEntry.grantsSkill)&&typeof currentCardEntry.learned==='boolean'
    &&['ko','en'].every(currentLocaleCode=>typeof currentCardEntry.nameTranslations?.[currentLocaleCode]==='string'&&currentCardEntry.nameTranslations[currentLocaleCode].trim()));
   currentSeenIdentifiers.add(currentCardEntry.cardId);
  }
 }
 for(const currentCardEntry of currentResponseValue.cards){
  requireCardResponseCondition(currentCardEntry.storage==='ACCOUNT'&&currentCardEntry.expiresAt===null
   &&['purchase','event','legacy_book','developer'].includes(currentCardEntry.source)&&Number.isFinite(currentCardEntry.acquiredAt)&&currentCardEntry.acquiredAt>=0
   &&Number.isSafeInteger(currentCardEntry.currentLiteracy)&&currentCardEntry.currentLiteracy>=0);
 }
 for(const currentCatalogEntry of currentResponseValue.catalog??[]){
  requireCardResponseCondition(typeof currentCatalogEntry.owned==='boolean'&&currentCatalogEntry.owned===currentResponseValue.cards.some(currentCardEntry=>currentCardEntry.cardId===currentCatalogEntry.cardId)
   &&Number.isSafeInteger(currentCatalogEntry.priceP)&&currentCatalogEntry.priceP>0);
 }
 return currentResponseValue;
}
export function validateSkillCardCommandResponse(currentCommandResult,currentExpectedCommand){
 const currentReturnedState=currentCommandResult?.state;
 const currentCommandReceipt=currentCommandResult?.receipt;
 requireCardResponseCondition(currentReturnedState?.protocolVersion===1&&currentReturnedState?.me?.id===currentExpectedCommand.characterId
  &&currentReturnedState.generation===currentExpectedCommand.generation
  &&['epoch','cursor'].every(currentFieldName=>Number.isSafeInteger(currentReturnedState[currentFieldName])&&currentReturnedState[currentFieldName]>=0)
  &&Number.isSafeInteger(currentReturnedState.me.version)&&currentReturnedState.me.version>=currentExpectedCommand.expectedVersion
  &&currentCommandReceipt&&SKILL_CARD_UUID_PATTERN.test(currentCommandReceipt.requestId)&&currentCommandReceipt.requestId===currentExpectedCommand.requestId
  &&Number.isFinite(currentCommandReceipt.completedAt)&&currentCommandReceipt.completedAt>=0);
 const currentExpectedIdentity=currentExpectedCommand.command;
 requireCardResponseCondition(currentCommandReceipt.command&&Object.keys(currentCommandReceipt.command).length===Object.keys(currentExpectedIdentity).length
  &&Object.entries(currentExpectedIdentity).every(([currentFieldName,currentFieldValue])=>currentCommandReceipt.command[currentFieldName]===currentFieldValue)
  &&currentCommandReceipt.result?.cardId===currentExpectedIdentity.cardId);
 if(currentExpectedIdentity.kind==='purchase'){
  requireCardResponseCondition(currentCommandReceipt.result.priceP===currentExpectedIdentity.priceP&&currentCommandReceipt.result.storage==='ACCOUNT'&&currentCommandReceipt.result.expiresAt===null);
 }else{
  requireCardResponseCondition(currentExpectedIdentity.kind==='use'&&currentCommandReceipt.result.level===0&&currentCommandReceipt.result.skillId===currentExpectedCommand.grantsSkill
   &&Number.isSafeInteger(currentReturnedState.me.skills?.[currentExpectedCommand.grantsSkill])&&currentReturnedState.me.skills[currentExpectedCommand.grantsSkill]>=0);
 }
}
