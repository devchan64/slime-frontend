export type GuildRecruitmentPage={characterVersion:number;entries:{cityId:string;registeredAt:number}[]};
export function parseGuildRecruitmentPage(currentResponseValue:any):GuildRecruitmentPage{
  if(!currentResponseValue||!Number.isSafeInteger(currentResponseValue.characterVersion)||currentResponseValue.characterVersion<0||!Array.isArray(currentResponseValue.entries))
    throw new Error('길드 모집 등록 응답 형식이 올바르지 않습니다.');
  const currentCityIdentifiers=new Set<string>();
  for(const currentRegistrationEntry of currentResponseValue.entries){
    if(!currentRegistrationEntry||typeof currentRegistrationEntry.cityId!=='string'||!currentRegistrationEntry.cityId.trim()||currentCityIdentifiers.has(currentRegistrationEntry.cityId)
      ||!Number.isFinite(currentRegistrationEntry.registeredAt)||currentRegistrationEntry.registeredAt<0)throw new Error('길드 모집 등록 항목이 올바르지 않습니다.');
    currentCityIdentifiers.add(currentRegistrationEntry.cityId);
  }
  return currentResponseValue;
}
export function validateGuildRegistrationResult(currentResponseValue:any,currentCityIdentifier:string,currentRegistrationEnabled:boolean){
  if(!currentResponseValue||currentResponseValue.cityId!==currentCityIdentifier||currentResponseValue.registered!==currentRegistrationEnabled
    ||!Number.isSafeInteger(currentResponseValue.characterVersion)||currentResponseValue.characterVersion<0)throw new Error('길드 모집 변경 응답이 요청과 다릅니다.');
}
