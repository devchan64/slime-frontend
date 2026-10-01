export type TravelerPermitRecord = {
  instanceId: string; itemId: 'city-traveler-permit'; characterId: string; cityId: string; cityName: string;
  issuerId: string; issuedAt: number; expiresAt: number; status: 'PENDING' | 'VALID' | 'EXPIRED';
  nameTranslations: {ko: string; en: string}; quantity: 1; weightG: null;
};
export type TravelerPermitSummary = {records: TravelerPermitRecord[]};
const TRAVELER_PERMIT_DURATION_SECONDS = 7 * 24 * 60 * 60;
const INVALID_PERMIT_RESPONSE_MESSAGE = '여행자증명서 표시 정보가 올바르지 않습니다.';
const TRAVELER_PERMIT_RECORD_KEYS = 'characterId,cityId,cityName,expiresAt,instanceId,issuedAt,issuerId,itemId,nameTranslations,quantity,status,weightG';

export function validateTravelerPermitSummary(currentSummaryValue: TravelerPermitSummary, currentServerTimestamp: number, currentCharacterIdentifier?: string): TravelerPermitSummary {
  if (!currentSummaryValue || Object.keys(currentSummaryValue).join(',') !== 'records'
      || !Array.isArray(currentSummaryValue.records) || !Number.isFinite(currentServerTimestamp) || currentServerTimestamp < 0) {
    throw new Error(INVALID_PERMIT_RESPONSE_MESSAGE);
  }
  const currentInstanceIdentifiers = new Set<string>();
  for (const currentPermitRecord of currentSummaryValue.records) {
    if (!currentPermitRecord || Object.keys(currentPermitRecord).sort().join(',') !== TRAVELER_PERMIT_RECORD_KEYS
        || ![currentPermitRecord.instanceId,currentPermitRecord.characterId,currentPermitRecord.cityId,currentPermitRecord.cityName,currentPermitRecord.issuerId]
          .every(currentTextValue => typeof currentTextValue === 'string' && !!currentTextValue.trim())
        || currentInstanceIdentifiers.has(currentPermitRecord.instanceId)
        || currentPermitRecord.itemId !== 'city-traveler-permit' || currentPermitRecord.quantity !== 1 || currentPermitRecord.weightG !== null
        || !currentPermitRecord.nameTranslations || Object.keys(currentPermitRecord.nameTranslations).sort().join(',') !== 'en,ko'
        || ![currentPermitRecord.nameTranslations.ko,currentPermitRecord.nameTranslations.en]
          .every(currentTextValue => typeof currentTextValue === 'string' && !!currentTextValue.trim())
        || !Number.isFinite(currentPermitRecord.issuedAt) || currentPermitRecord.issuedAt < 0
        || !Number.isFinite(currentPermitRecord.expiresAt) || currentPermitRecord.expiresAt !== currentPermitRecord.issuedAt + TRAVELER_PERMIT_DURATION_SECONDS
        || currentPermitRecord.status !== (currentServerTimestamp < currentPermitRecord.issuedAt ? 'PENDING' : currentServerTimestamp >= currentPermitRecord.expiresAt ? 'EXPIRED' : 'VALID')
        || currentCharacterIdentifier !== undefined && currentPermitRecord.characterId !== currentCharacterIdentifier) {
      throw new Error(INVALID_PERMIT_RESPONSE_MESSAGE);
    }
    currentInstanceIdentifiers.add(currentPermitRecord.instanceId);
  }
  return currentSummaryValue;
}
