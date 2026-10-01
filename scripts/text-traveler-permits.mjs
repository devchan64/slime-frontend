// 경비센터 현장 접근과 유료 증서 견적의 터미널 계약.
const TRAVELER_ISSUANCE_PRICE_P = 5;
const TRAVELER_VALIDITY_DURATION_SECONDS = 604800;
const TRAVELER_QUOTE_FIELD_NAMES = ['cityId','expiresAt','guardCenterId','policyVersion','priceP','serverTime','validitySeconds'];
const GUARD_IDENTIFIER_TEXT_PATTERN = /^[a-z][a-z0-9-]*$/;

export function readTravelerGuardCenters(currentGameState) {
  const currentGuardEntries=currentGameState?.map?.guardCenters;
  if(currentGuardEntries===undefined)throw new Error('경비센터 정보가 없습니다. state로 최신 상태를 확인하세요.');
  if(!Array.isArray(currentGuardEntries))throw new Error('경비센터 목록 형식이 올바르지 않습니다.');
  const seenGuardIdentifiers=new Set();
  for(const currentGuardEntry of currentGuardEntries){
    if(!currentGuardEntry || typeof currentGuardEntry.id!=='string' || GUARD_IDENTIFIER_TEXT_PATTERN.exec(currentGuardEntry.id)?.[0]!==currentGuardEntry.id
      || seenGuardIdentifiers.has(currentGuardEntry.id) || typeof currentGuardEntry.name!=='string' || !currentGuardEntry.name
      || typeof currentGuardEntry.cityId!=='string' || !currentGuardEntry.cityId || currentGuardEntry.mapId!==currentGameState.map.id
      || !Number.isSafeInteger(currentGuardEntry.position?.column) || currentGuardEntry.position.column<0
      || !Number.isSafeInteger(currentGuardEntry.position?.row) || currentGuardEntry.position.row<0)throw new Error('경비센터 목록 형식이 올바르지 않습니다.');
    seenGuardIdentifiers.add(currentGuardEntry.id);
  }
  return currentGuardEntries;
}

export function requireTravelerGuardPresence(currentGameState,currentGuardIdentifier) {
  const currentGuardEntry=readTravelerGuardCenters(currentGameState).find(currentGuardEntry=>currentGuardEntry.id===currentGuardIdentifier);
  if(!currentGuardEntry || currentGameState.me.mode!=='FIELD' || currentGameState.battle || currentGameState.reservation
    || currentGameState.me.position?.column!==currentGuardEntry.position.column || currentGameState.me.position?.row!==currentGuardEntry.position.row)
    throw new Error('전투·조우를 종료하고 해당 경비센터 좌표에 도착하세요.');
  return currentGuardEntry;
}

export function validateTravelerQuoteResponse(currentQuoteResponse,currentGuardEntry) {
  if(!currentQuoteResponse || Object.keys(currentQuoteResponse).sort().join(',')!==TRAVELER_QUOTE_FIELD_NAMES.join(',')
    || currentQuoteResponse.guardCenterId!==currentGuardEntry.id || currentQuoteResponse.cityId!==currentGuardEntry.cityId
    || currentQuoteResponse.priceP!==TRAVELER_ISSUANCE_PRICE_P || currentQuoteResponse.validitySeconds!==TRAVELER_VALIDITY_DURATION_SECONDS
    || !Number.isSafeInteger(currentQuoteResponse.policyVersion) || currentQuoteResponse.policyVersion<1
    || !Number.isFinite(currentQuoteResponse.serverTime) || currentQuoteResponse.serverTime<0
    || !Number.isFinite(currentQuoteResponse.expiresAt) || currentQuoteResponse.expiresAt<=currentQuoteResponse.serverTime)
    throw new Error('여행자증명서 견적 응답이 올바르지 않습니다.');
  return currentQuoteResponse;
}

export function captureTravelerQuoteContext(currentGameState) {
  return JSON.stringify([currentGameState.me.id,currentGameState.me.version,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map.id,currentGameState.me.position?.column,currentGameState.me.position?.row]);
}

const TRAVELER_PERMIT_PUBLIC_KEYS = 'characterId,cityId,cityName,expiresAt,instanceId,issuedAt,issuerId,itemId,nameTranslations,quantity,status,weightG';
const TRAVELER_STATUS_DISPLAY_NAMES = {PENDING:'발급 전',VALID:'유효',EXPIRED:'만료'};

export function formatTravelerPermitSummary(currentPermitSummary,currentServerTimestamp,currentCharacterIdentifier) {
  if(currentPermitSummary===undefined)return '현재 서버 응답에 여행자증명서 정보가 없습니다.';
  const invalidPermitResponseMessage='여행자증명서 응답이 올바르지 않습니다.';
  if(!currentPermitSummary || Object.keys(currentPermitSummary).join(',')!=='records' || !Array.isArray(currentPermitSummary.records)
    || !Number.isFinite(currentServerTimestamp) || currentServerTimestamp<0)throw new Error(invalidPermitResponseMessage);
  const seenPermitIdentifiers=new Set();
  const renderedPermitLines=[];
  const sanitizePermitText=currentTextValue=>currentTextValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');
  for(const currentPermitRecord of currentPermitSummary.records){
    if(!currentPermitRecord || Object.keys(currentPermitRecord).sort().join(',')!==TRAVELER_PERMIT_PUBLIC_KEYS
      || !['instanceId','characterId','cityId','cityName','issuerId'].every(currentFieldName=>typeof currentPermitRecord[currentFieldName]==='string'&&!!currentPermitRecord[currentFieldName].trim())
      || currentPermitRecord.characterId!==currentCharacterIdentifier || seenPermitIdentifiers.has(currentPermitRecord.instanceId)
      || currentPermitRecord.itemId!=='city-traveler-permit' || currentPermitRecord.quantity!==1 || currentPermitRecord.weightG!==null
      || !currentPermitRecord.nameTranslations || Object.keys(currentPermitRecord.nameTranslations).sort().join(',')!=='en,ko'
      || !['ko','en'].every(currentLocaleCode=>typeof currentPermitRecord.nameTranslations[currentLocaleCode]==='string'&&!!currentPermitRecord.nameTranslations[currentLocaleCode].trim())
      || !Number.isFinite(currentPermitRecord.issuedAt) || currentPermitRecord.issuedAt<0
      || currentPermitRecord.expiresAt!==currentPermitRecord.issuedAt+TRAVELER_VALIDITY_DURATION_SECONDS
      || currentPermitRecord.status!==(currentServerTimestamp<currentPermitRecord.issuedAt?'PENDING':currentServerTimestamp>=currentPermitRecord.expiresAt?'EXPIRED':'VALID'))throw new Error(invalidPermitResponseMessage);
    const currentIssuedDate=new Date(currentPermitRecord.issuedAt*1000),currentExpiryDate=new Date(currentPermitRecord.expiresAt*1000);
    if(!Number.isFinite(currentIssuedDate.getTime())||!Number.isFinite(currentExpiryDate.getTime()))throw new Error(invalidPermitResponseMessage);
    seenPermitIdentifiers.add(currentPermitRecord.instanceId);
    renderedPermitLines.push('여행자증명서 · '+sanitizePermitText(currentPermitRecord.cityName)+' ['+TRAVELER_STATUS_DISPLAY_NAMES[currentPermitRecord.status]+']'
      +' | 증서 '+sanitizePermitText(currentPermitRecord.instanceId)+' | 발급처 '+sanitizePermitText(currentPermitRecord.issuerId)
      +' | 발급 '+currentIssuedDate.toISOString()+' | 만료 '+currentExpiryDate.toISOString());
  }
  return renderedPermitLines.join('\n') || '보유한 여행자증명서가 없습니다.';
}

export function parseTravelerBarterSelection(currentCommandArguments) {
  if(currentCommandArguments.length<4||!/^(0|[1-9][0-9]*)$/.test(currentCommandArguments[2]))throw new Error('permit barter 경비센터ID 현금p 재료ID=수량 ... 형식으로 입력하세요.');
  const currentCashAmount=Number(currentCommandArguments[2]);
  if(!Number.isSafeInteger(currentCashAmount))throw new Error('현금 수치가 올바르지 않습니다.');
  const currentMaterialSelection={};
  for(const currentMaterialToken of currentCommandArguments.slice(3)){
    const currentTokenMatch=/^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)=([1-9][0-9]*)$/.exec(currentMaterialToken);
    if(!currentTokenMatch||Object.hasOwn(currentMaterialSelection,currentTokenMatch[1])||!Number.isSafeInteger(Number(currentTokenMatch[2])))throw new Error('재료 ID와 양의 정수 수량을 중복 없이 입력하세요.');
    currentMaterialSelection[currentTokenMatch[1]]=Number(currentTokenMatch[2]);
  }
  return {cashP:currentCashAmount,materials:currentMaterialSelection};
}

export function validateTravelerBarterQuote(currentQuoteResponse,currentGuardEntry,currentSelectedPayment) {
  if(!currentQuoteResponse||!Object.hasOwn(currentQuoteResponse,'payment'))throw new Error('혼합 납부 견적이 없습니다.');
  const {payment:currentPaymentRecord,...currentBaseQuote}=currentQuoteResponse;
  validateTravelerQuoteResponse(currentBaseQuote,currentGuardEntry);
  const currentInvalidMessage='혼합 납부 견적 응답이 올바르지 않습니다.';
  if(!currentPaymentRecord||Object.keys(currentPaymentRecord).sort().join(',')!=='cashP,excessValueP,materialValues,materials,totalValueP'
    ||currentPaymentRecord.cashP!==currentSelectedPayment.cashP||!currentPaymentRecord.materials||!currentPaymentRecord.materialValues
    ||Object.keys(currentPaymentRecord.materials).sort().join(',')!==Object.keys(currentSelectedPayment.materials).sort().join(',')
    ||Object.keys(currentPaymentRecord.materialValues).sort().join(',')!==Object.keys(currentSelectedPayment.materials).sort().join(','))throw new Error(currentInvalidMessage);
  let currentTotalValue=currentPaymentRecord.cashP;
  for(const [currentMaterialIdentifier,currentMaterialQuantity] of Object.entries(currentSelectedPayment.materials)){
    const currentStandardValue=currentPaymentRecord.materialValues[currentMaterialIdentifier];
    if(currentPaymentRecord.materials[currentMaterialIdentifier]!==currentMaterialQuantity||!Number.isSafeInteger(currentStandardValue)||currentStandardValue<1)throw new Error(currentInvalidMessage);
    currentTotalValue+=currentMaterialQuantity*currentStandardValue;
  }
  if(!Number.isSafeInteger(currentTotalValue)||currentTotalValue<currentBaseQuote.priceP||currentPaymentRecord.totalValueP!==currentTotalValue||currentPaymentRecord.excessValueP!==currentTotalValue-currentBaseQuote.priceP)throw new Error(currentInvalidMessage);
  return currentQuoteResponse;
}

export function formatTravelerBarterPayment(currentPaymentRecord) {
  return '현금 '+currentPaymentRecord.cashP+'p\n'+Object.entries(currentPaymentRecord.materials).map(([currentMaterialIdentifier,currentMaterialQuantity])=>
    currentMaterialIdentifier+' × '+currentMaterialQuantity+' · 표준 가치 '+currentPaymentRecord.materialValues[currentMaterialIdentifier]+'p/개').join('\n')
    +'\n납부 가치 '+currentPaymentRecord.totalValueP+'p · 초과 '+currentPaymentRecord.excessValueP+'p (거스름돈 없음)';
}
