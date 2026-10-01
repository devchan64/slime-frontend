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
  return JSON.stringify([currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map.id,currentGameState.me.position]);
}
