import {validateTravelerBarterQuote,type TravelerBarterSelection,type TravelerBarterPayment} from './traveler-barter-validation.mjs';
export type {TravelerBarterPayment} from './traveler-barter-validation.mjs';
import {validateTravelerPermitSummary} from './travelerPermits';
import type {State} from './types';

export type GuardCenterRecord = {id:string;cityId:string;mapId:string;connectionId:string;name:string;position:{column:number;row:number}};
export type TravelerPermitQuote = {guardCenterId:string;cityId:string;policyVersion:number;priceP:number;validitySeconds:number;serverTime:number;expiresAt:number};
const INVALID_TRAVELER_QUOTE_MESSAGE = '여행자증명서 견적 정보가 올바르지 않습니다.';

export function findFieldGuardCenter(currentMapDefinition: State['map'], currentConnectionIdentifier: string): GuardCenterRecord | undefined {
  if (currentMapDefinition.guardCenters === undefined) return undefined;
  if (!Array.isArray(currentMapDefinition.guardCenters)) throw new Error('경비센터 목록이 올바르지 않습니다.');
  const currentGuardIdentifiers = new Set<string>();
  for (const currentGuardRecord of currentMapDefinition.guardCenters) {
    const currentConnectionRecord = currentMapDefinition.connections.find(currentConnectionEntry => currentConnectionEntry.id === currentGuardRecord?.connectionId);
    if (!currentGuardRecord || Object.keys(currentGuardRecord).sort().join(',') !== 'cityId,connectionId,id,mapId,name,position' || currentMapDefinition.safeTown || currentGuardRecord.mapId !== currentMapDefinition.id
      || ![currentGuardRecord.id,currentGuardRecord.name,currentGuardRecord.cityId].every(currentTextValue => typeof currentTextValue === 'string' && !!currentTextValue.trim())
      || currentGuardIdentifiers.has(currentGuardRecord.id) || !currentConnectionRecord || currentConnectionRecord.target !== currentGuardRecord.cityId
      || currentConnectionRecord.targetSafeTown !== true || !currentGuardRecord.position
      || currentGuardRecord.position.column !== currentConnectionRecord.column || currentGuardRecord.position.row !== currentConnectionRecord.row) throw new Error('경비센터와 도시 입구가 일치하지 않습니다.');
    currentGuardIdentifiers.add(currentGuardRecord.id);
  }
  return currentMapDefinition.guardCenters.find(currentGuardRecord => currentGuardRecord.connectionId === currentConnectionIdentifier);
}

export function parseTravelerPermitQuote(currentResponseValue: TravelerPermitQuote, currentGuardDefinition: GuardCenterRecord): TravelerPermitQuote {
  if (!currentResponseValue || Object.keys(currentResponseValue).sort().join(',') !== 'cityId,expiresAt,guardCenterId,policyVersion,priceP,serverTime,validitySeconds'
      || currentResponseValue.guardCenterId !== currentGuardDefinition.id || currentResponseValue.cityId !== currentGuardDefinition.cityId
      || !Number.isSafeInteger(currentResponseValue.policyVersion) || currentResponseValue.policyVersion < 1
      || currentResponseValue.priceP !== 5 || currentResponseValue.validitySeconds !== 604800
      || !Number.isFinite(currentResponseValue.serverTime) || currentResponseValue.serverTime < 0
      || !Number.isFinite(currentResponseValue.expiresAt) || currentResponseValue.expiresAt <= currentResponseValue.serverTime) throw new Error(INVALID_TRAVELER_QUOTE_MESSAGE);
  return currentResponseValue;
}

export function validateTravelerPurchaseReceipt(currentReceiptValue: any, currentOriginalRequest: Record<string,unknown>, currentGuardDefinition: GuardCenterRecord, currentCharacterIdentifier: string) {
  const currentExpectedKeys=currentOriginalRequest.payment?'guardCenterId,payment,permit,policyVersion,priceP,quotedExpiresAt,requestId':'guardCenterId,permit,policyVersion,priceP,quotedExpiresAt,requestId';
  if (!currentReceiptValue || Object.keys(currentReceiptValue).sort().join(',') !== currentExpectedKeys
      || currentReceiptValue.guardCenterId !== currentGuardDefinition.id
      || !['requestId','policyVersion','priceP','quotedExpiresAt'].every(currentFieldName => currentReceiptValue[currentFieldName] === currentOriginalRequest[currentFieldName])) throw new Error('여행자증명서 발급 영수증이 요청과 다릅니다.');
  if(currentOriginalRequest.payment){
    const currentExpectedPayment=currentOriginalRequest.payment as TravelerBarterPayment;
    validateTravelerBarterQuote({priceP:currentReceiptValue.priceP,payment:currentReceiptValue.payment},currentGuardDefinition,currentExpectedPayment,()=>{});
    for(const currentMaterialIdentifier of Object.keys(currentExpectedPayment.materialValues))if(currentReceiptValue.payment.materialValues[currentMaterialIdentifier]!==currentExpectedPayment.materialValues[currentMaterialIdentifier])throw new Error('납부 영수증의 재료 가치가 견적과 다릅니다.');
  }
  const currentPermitRecord = currentReceiptValue.permit;
  if (!currentPermitRecord || Object.keys(currentPermitRecord).sort().join(',') !== 'characterId,cityId,expiresAt,instanceId,issuedAt,issuerId,itemId'
      || currentPermitRecord.cityId !== currentGuardDefinition.cityId || currentPermitRecord.issuerId !== currentGuardDefinition.id) throw new Error('발급 증서의 도시·경비센터가 다릅니다.');
  validateTravelerPermitSummary({records:[{...currentPermitRecord,cityName:currentGuardDefinition.name,nameTranslations:{ko:'여행자증명서',en:'Traveler Certificate'},status:'VALID',quantity:1,weightG:null}]},currentPermitRecord.issuedAt,currentCharacterIdentifier);
}

export function parseTravelerBarterQuote(currentResponseValue:TravelerPermitQuote & {payment:TravelerBarterPayment},currentGuardDefinition:GuardCenterRecord,currentSelection:TravelerBarterSelection){
  return validateTravelerBarterQuote(currentResponseValue,currentGuardDefinition,currentSelection,parseTravelerPermitQuote);
}
