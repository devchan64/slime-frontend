export type CitizenshipRecord={cityId:string;cityName:string;source:'initial'|'purchase';startsAt:number;expiresAt:number;status:'PENDING'|'VALID'|'EXPIRED'};
export type CitizenshipSummary={records:CitizenshipRecord[]};
const INVALID_CITIZENSHIP_MESSAGE='시민권 표시 정보가 올바르지 않습니다.';
export function validateCitizenshipSummary(currentSummaryValue:CitizenshipSummary):CitizenshipSummary {
  if(!currentSummaryValue||Object.keys(currentSummaryValue).join(',')!=='records'
    ||!Array.isArray(currentSummaryValue.records))throw new Error(INVALID_CITIZENSHIP_MESSAGE);
  for(const currentCitizenshipRecord of currentSummaryValue.records){
    if(!currentCitizenshipRecord||Object.keys(currentCitizenshipRecord).sort().join(',')!=='cityId,cityName,expiresAt,source,startsAt,status'
      ||![currentCitizenshipRecord.cityId,currentCitizenshipRecord.cityName].every(currentTextValue=>typeof currentTextValue==='string'&&!!currentTextValue.trim())
      ||!['initial','purchase'].includes(currentCitizenshipRecord.source)||!Number.isFinite(currentCitizenshipRecord.startsAt)||currentCitizenshipRecord.startsAt<0
      ||!Number.isFinite(currentCitizenshipRecord.expiresAt)||currentCitizenshipRecord.expiresAt<=currentCitizenshipRecord.startsAt
      ||!['PENDING','VALID','EXPIRED'].includes(currentCitizenshipRecord.status))throw new Error(INVALID_CITIZENSHIP_MESSAGE);
  }
  return currentSummaryValue;
}
