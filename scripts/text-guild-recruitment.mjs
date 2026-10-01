import {parseGuildRecruitmentPage,validateGuildRegistrationResult} from '../src/client/guild-recruitment-validation.mjs';
const GUILD_RECRUITMENT_IDENTIFIER=/^[a-z][a-z0-9-]{0,99}$/;
export async function executeGuildRecruitment(currentTextClient,currentCommandArguments){
 const [currentActionName,...currentActionArguments]=currentCommandArguments;
 if(!['list','register','unregister'].includes(currentActionName)||currentActionArguments.length!==({list:0,register:1,unregister:2}[currentActionName]))
  throw new Error('recruitment list / recruitment register 길드ID / recruitment unregister 도시ID 길드ID로 입력하세요.');
 const currentGameState=currentTextClient.state;
 if(!currentGameState)throw new Error('먼저 로그인하세요.');
 if(currentActionArguments.some(currentIdentifierValue=>!GUILD_RECRUITMENT_IDENTIFIER.test(currentIdentifierValue)))throw new Error('도시·길드 ID 형식을 확인하세요.');
 if(currentActionName==='list'){
  const currentRequestTokens=currentTextClient.tokens;
  const currentRequestContext=JSON.stringify([currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.me.version]);
  const currentResponsePage=parseGuildRecruitmentPage(await currentTextClient.request('/v1/game/guild-recruitments'));
  const currentLatestState=currentTextClient.state;
  if(currentTextClient.tokens!==currentRequestTokens||!currentLatestState
   ||currentRequestContext!==JSON.stringify([currentLatestState.me.id,currentLatestState.generation,currentLatestState.epoch,currentLatestState.me.version])
   ||currentResponsePage.characterVersion!==currentLatestState.me.version)throw new Error('등록 조회 중 상태가 변경되었습니다. 다시 조회하세요.');
  return currentResponsePage.entries.map(currentRegistrationEntry=>{
   const currentRegistrationDate=new Date(currentRegistrationEntry.registeredAt*1000);
   if(!GUILD_RECRUITMENT_IDENTIFIER.test(currentRegistrationEntry.cityId)||!Number.isFinite(currentRegistrationDate.getTime()))throw new Error('모집 등록 정보가 올바르지 않습니다.');
   return `${currentRegistrationEntry.cityId} · 등록 ${currentRegistrationDate.toISOString()}`;
  }).join('\n')||'모집 후보로 등록된 도시가 없습니다.';
 }
 const currentRegistrationEnabled=currentActionName==='register';
 const currentFacilityIdentifier=currentActionArguments[currentRegistrationEnabled?0:1];
 const currentCityIdentifier=currentRegistrationEnabled?currentGameState.map?.id:currentActionArguments[0];
 if(currentRegistrationEnabled){
  const currentGuildBuilding=currentGameState.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityId===currentFacilityIdentifier&&currentBuildingEntry.facilityKind==='guild');
  if(!currentGuildBuilding||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation
   ||currentGameState.me.position?.column!==currentGuildBuilding.entrance?.column||currentGameState.me.position?.row!==currentGuildBuilding.entrance?.row)
   throw new Error('전투·조우를 종료하고 해당 길드회관 입구에서 등록하세요.');
 }
 return currentTextClient.command('/v1/game/guilds/'+currentFacilityIdentifier+'/registration',{registered:currentRegistrationEnabled},
  ()=>`${currentCityIdentifier} 모집 후보 ${currentRegistrationEnabled?'등록':'해제'} 완료 · 기존 대여 계약은 유지됩니다.`,{
   includeRequestIdentifier:false,fetchStateAfterReceipt:true,
   validateCommandResponse:currentResponseRecord=>validateGuildRegistrationResult(currentResponseRecord,currentCityIdentifier,currentRegistrationEnabled),
   readReceiptCharacterVersion:currentResponseRecord=>currentResponseRecord.characterVersion,
  });
}
