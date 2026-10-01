// 시민권 발급은 길드 현장 견적을 확인한 뒤 기존 명령 계약으로 확정한다.
const CITIZENSHIP_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const CITIZENSHIP_QUOTE_FIELDS='cityId,expiresAt,policyVersion,priceP,serverTime';
function captureCitizenshipContext(currentGameState){return JSON.stringify([currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map.id,currentGameState.me.position,currentGameState.me.version]);}
function readCitizenshipGuilds(currentGameState){
 const currentBuildingEntries=currentGameState?.map?.buildings;
 if(!Array.isArray(currentBuildingEntries))throw new Error('건물 목록이 없습니다. state로 최신 상태를 확인하세요.');
 return currentBuildingEntries.filter(currentBuildingEntry=>currentBuildingEntry.facilityKind==='guild').map(currentBuildingEntry=>{
  if(typeof currentBuildingEntry.facilityId!=='string'||!CITIZENSHIP_IDENTIFIER_PATTERN.test(currentBuildingEntry.facilityId)||typeof currentBuildingEntry.name!=='string'
   ||![currentBuildingEntry.entrance?.column,currentBuildingEntry.entrance?.row].every(currentCoordinateValue=>Number.isSafeInteger(currentCoordinateValue)&&currentCoordinateValue>=0))throw new Error('길드 정보가 올바르지 않습니다.');
  return currentBuildingEntry;
 });
}
export async function executeCitizenshipCommand(currentTextClient,currentCommandArguments){
 const currentGameState=currentTextClient.state;
 if(currentCommandArguments.length===1&&currentCommandArguments[0]==='guilds')return readCitizenshipGuilds(currentGameState).map(currentGuildEntry=>currentGuildEntry.name.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ')+' ['+currentGuildEntry.facilityId+'] 입구 ('+currentGuildEntry.entrance.column+','+currentGuildEntry.entrance.row+')').join('\n')||'현재 맵에 모험가 길드가 없습니다.';
 const [currentActionName,currentFacilityIdentifier]=currentCommandArguments;
 if(currentCommandArguments.length!==2||!['quote','buy'].includes(currentActionName)||!CITIZENSHIP_IDENTIFIER_PATTERN.test(currentFacilityIdentifier))throw new Error('citizenship guilds / citizenship quote 길드ID / citizenship buy 길드ID로 입력하세요.');
 const currentGuildEntry=readCitizenshipGuilds(currentGameState).find(currentGuildEntry=>currentGuildEntry.facilityId===currentFacilityIdentifier);
 if(!currentGuildEntry||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation
  ||currentGameState.me.position?.column!==currentGuildEntry.entrance.column||currentGameState.me.position?.row!==currentGuildEntry.entrance.row)throw new Error('전투·조우를 종료하고 해당 모험가 길드 입구로 이동하세요.');
 const currentQuoteContext=captureCitizenshipContext(currentGameState);
 const currentRequestPrefix='/v1/game/guilds/'+encodeURIComponent(currentFacilityIdentifier)+'/citizenship-';
 if(currentActionName==='quote'){
  currentTextClient.citizenshipQuote=null;
  const currentRequestStarted=performance.now();
  const currentQuoteData=await currentTextClient.request(currentRequestPrefix+'quote');
  if(!currentQuoteData||Object.keys(currentQuoteData).sort().join(',')!==CITIZENSHIP_QUOTE_FIELDS
   ||currentQuoteData.cityId!==currentGameState.map.id||currentQuoteData.priceP!==100
   ||!Number.isSafeInteger(currentQuoteData.policyVersion)||currentQuoteData.policyVersion<1
   ||!Number.isFinite(currentQuoteData.serverTime)||currentQuoteData.serverTime<0||!Number.isFinite(currentQuoteData.expiresAt)||currentQuoteData.expiresAt<=currentQuoteData.serverTime)throw new Error('시민권 견적 응답이 올바르지 않습니다.');
  if(captureCitizenshipContext(currentTextClient.state)!==currentQuoteContext)throw new Error('견적 조회 중 상태가 변경되었습니다. 다시 확인하세요.');
  currentTextClient.citizenshipQuote={context:currentQuoteContext,facilityId:currentFacilityIdentifier,data:currentQuoteData,deadline:currentRequestStarted+(currentQuoteData.expiresAt-currentQuoteData.serverTime)*1000};
  return '시민권 100p · 발급일부터 현실 1년 · 도시 '+currentQuoteData.cityId+'\n발급 확정: citizenship buy '+currentFacilityIdentifier;
 }
 const currentSavedQuote=currentTextClient.citizenshipQuote;
 if(!currentSavedQuote||currentSavedQuote.context!==currentQuoteContext||currentSavedQuote.facilityId!==currentFacilityIdentifier||performance.now()>=currentSavedQuote.deadline)throw new Error('유효한 견적이 없습니다. citizenship quote 길드ID로 먼저 확인하세요.');
 currentTextClient.citizenshipQuote=null;
 return currentTextClient.command(currentRequestPrefix+'purchases',{policyVersion:currentSavedQuote.data.policyVersion,priceP:currentSavedQuote.data.priceP,quotedExpiresAt:currentSavedQuote.data.expiresAt});
}
