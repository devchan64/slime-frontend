export type RefiningContractEntry = {
  contractId:string; facilityId:string; startedAt:number; readyAt:number; claimedAt:number|null;
  status:'IN_PROGRESS'|'READY'|'CLAIMED';
  quote:{grade:'low'|'medium'|'high';outputQuantity:number;inputQuantity:number;costP:number;durationSeconds:number;
    outputMaterial:{materialId:string;name:string;englishName:string}};
};
export type RefiningContractPage = {serverTime:number;characterVersion:number;entries:RefiningContractEntry[];nextCursor:string|null};
const REFINING_STATUS_VALUES = ['IN_PROGRESS','READY','CLAIMED'];
function isRefiningInteger(currentNumericValue:unknown) {return Number.isSafeInteger(currentNumericValue)&&Number(currentNumericValue)>=0;}
export function parseRefiningContracts(currentResponseValue:any):RefiningContractPage {
  const currentContractIdentifiers=new Set<string>();
  if(!currentResponseValue || !Number.isFinite(currentResponseValue.serverTime) || currentResponseValue.serverTime<0
      || !isRefiningInteger(currentResponseValue.characterVersion) || !Array.isArray(currentResponseValue.entries)
      || !(currentResponseValue.nextCursor===null || typeof currentResponseValue.nextCursor==='string'&&currentResponseValue.nextCursor.trim())) throw new Error('정제 계약 목록이 올바르지 않습니다.');
  for(const currentContractEntry of currentResponseValue.entries) {
    const currentSavedQuote=currentContractEntry?.quote;
    if(!currentContractEntry || typeof currentContractEntry.contractId!=='string' || !currentContractEntry.contractId.trim()
        || currentContractIdentifiers.has(currentContractEntry.contractId) || typeof currentContractEntry.facilityId!=='string' || !currentContractEntry.facilityId.trim()
        || ![currentContractEntry.startedAt,currentContractEntry.readyAt].every(currentTimeValue=>Number.isFinite(currentTimeValue)&&currentTimeValue>=0)
        || currentContractEntry.readyAt<=currentContractEntry.startedAt || !REFINING_STATUS_VALUES.includes(currentContractEntry.status)
        || !currentSavedQuote || !['low','medium','high'].includes(currentSavedQuote.grade)
        || ![currentSavedQuote.outputQuantity,currentSavedQuote.inputQuantity,currentSavedQuote.costP,currentSavedQuote.durationSeconds].every(currentNumberValue=>isRefiningInteger(currentNumberValue)&&currentNumberValue>0)
        || currentContractEntry.readyAt!==currentContractEntry.startedAt+currentSavedQuote.durationSeconds
        || !['materialId','name','englishName'].every(currentFieldName=>typeof currentSavedQuote.outputMaterial?.[currentFieldName]==='string'&&currentSavedQuote.outputMaterial[currentFieldName].trim())) throw new Error('정제 계약 내용이 올바르지 않습니다.');
    if(currentContractEntry.claimedAt!==null && (!Number.isFinite(currentContractEntry.claimedAt)||currentContractEntry.claimedAt<currentContractEntry.readyAt||currentContractEntry.claimedAt>currentResponseValue.serverTime)) throw new Error('정제 수령 시각이 올바르지 않습니다.');
    const expectedContractStatus=currentContractEntry.claimedAt!==null?'CLAIMED':currentResponseValue.serverTime>=currentContractEntry.readyAt?'READY':'IN_PROGRESS';
    if(currentContractEntry.status!==expectedContractStatus) throw new Error('정제 계약 상태가 일치하지 않습니다.');
    currentContractIdentifiers.add(currentContractEntry.contractId);
  }
  return currentResponseValue;
}
