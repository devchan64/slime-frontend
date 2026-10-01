/** 현재 세율 조회 응답을 검증한다. 실패를 0%로 복구하지 않는다. */
const CITY_TAX_RESPONSE_FIELDS=['version','policyVersion','startsAt','expiresAt','evaluatedAt','observedAt','timezone','refreshHour','entries'];
const CITY_TAX_ENTRY_FIELDS=['cityId','cityName','paidCitizenshipCount','taxBasisPoints'];
const CITY_TAX_DAY_SECONDS=86400;
const CITY_TAX_ZONE_OFFSET_SECONDS=9*3600;
const CITY_TAX_REFRESH_OFFSET_SECONDS=4*3600;
const CITY_TAX_MAXIMUM_TIMESTAMP=8640000000000;
function requireExactFields(currentRecordValue,currentRequiredFields){
 if(!currentRecordValue||typeof currentRecordValue!=='object'||Array.isArray(currentRecordValue)||Object.keys(currentRecordValue).length!==currentRequiredFields.length||currentRequiredFields.some(currentFieldName=>!Object.hasOwn(currentRecordValue,currentFieldName)))throw new Error('도시 세율 응답 필드가 올바르지 않습니다.');
}
export function parseCityTaxResponse(currentResponseValue){
 requireExactFields(currentResponseValue,CITY_TAX_RESPONSE_FIELDS);
 if(currentResponseValue.version!==1||currentResponseValue.policyVersion!==2||currentResponseValue.timezone!=='Asia/Seoul'||currentResponseValue.refreshHour!==4)throw new Error('지원하지 않는 도시 세율 정책입니다.');
 for(const currentTimeField of ['startsAt','expiresAt','evaluatedAt','observedAt']){
  const currentTimeValue=currentResponseValue[currentTimeField];
  if(typeof currentTimeValue!=='number'||!Number.isFinite(currentTimeValue)||currentTimeValue<0||currentTimeValue>CITY_TAX_MAXIMUM_TIMESTAMP)throw new Error('도시 세율 시각이 올바르지 않습니다.');
 }
 if(currentResponseValue.expiresAt-currentResponseValue.startsAt!==CITY_TAX_DAY_SECONDS||currentResponseValue.evaluatedAt!==currentResponseValue.startsAt||currentResponseValue.observedAt<currentResponseValue.startsAt||currentResponseValue.observedAt>=currentResponseValue.expiresAt||(currentResponseValue.startsAt+CITY_TAX_ZONE_OFFSET_SECONDS)%CITY_TAX_DAY_SECONDS!==CITY_TAX_REFRESH_OFFSET_SECONDS)throw new Error('도시 세율 적용 구간이 올바르지 않습니다.');
 if(!Array.isArray(currentResponseValue.entries)||!currentResponseValue.entries.length)throw new Error('도시 세율 목록이 없습니다.');
 const currentCityIdentifiers=new Set();
 const currentValidatedEntries=currentResponseValue.entries.map(currentCityEntry=>{
  requireExactFields(currentCityEntry,CITY_TAX_ENTRY_FIELDS);
  if(typeof currentCityEntry.cityId!=='string'||!(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).test(currentCityEntry.cityId)||currentCityIdentifiers.has(currentCityEntry.cityId)||typeof currentCityEntry.cityName!=='string'||!currentCityEntry.cityName.trim())throw new Error('도시 세율 식별자가 올바르지 않습니다.');
  currentCityIdentifiers.add(currentCityEntry.cityId);
  if(!Number.isSafeInteger(currentCityEntry.paidCitizenshipCount)||currentCityEntry.paidCitizenshipCount<0||!Number.isInteger(currentCityEntry.taxBasisPoints)||currentCityEntry.taxBasisPoints<0||currentCityEntry.taxBasisPoints>1000)throw new Error('도시 세율 수치가 올바르지 않습니다.');
  return {...currentCityEntry};
 });
 return {...currentResponseValue,entries:currentValidatedEntries};
}
