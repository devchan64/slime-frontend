import {validateCitizenshipSummary} from '../src/client/citizenship-summary-validation.mjs';
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
 if(currentCommandArguments.length===1&&currentCommandArguments[0]==='list'){
  await currentTextClient.snapshot();
  return formatCitizenshipSummary(currentTextClient.state.me.citizenshipSummary,currentTextClient.state.serverTime);
 }
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

const CITIZENSHIP_STATUS_LABELS={PENDING:'발급 전',VALID:'유효',EXPIRED:'만료'};
export function formatCitizenshipSummary(currentSummaryValue,currentServerTime){
 if(currentSummaryValue===undefined)return '현재 서버 응답에 시민권 정보가 없습니다.';
 const currentSummaryData=validateCitizenshipSummary(currentSummaryValue);
 if(!Number.isFinite(currentServerTime)||currentServerTime<0)throw new Error('시민권 상태를 확인할 서버 시각이 없습니다.');
 const currentSummaryLines=currentSummaryData.records.map(currentCitizenRecord=>{
  const currentExpectedStatus=currentServerTime<currentCitizenRecord.startsAt?'PENDING':currentServerTime>=currentCitizenRecord.expiresAt?'EXPIRED':'VALID';
  if(currentCitizenRecord.status!==currentExpectedStatus)throw new Error('시민권 상태와 서버 시각이 일치하지 않습니다.');
  const currentStartDate=new Date(currentCitizenRecord.startsAt*1000),currentExpiryDate=new Date(currentCitizenRecord.expiresAt*1000);
  if(!Number.isFinite(currentStartDate.getTime())||!Number.isFinite(currentExpiryDate.getTime()))throw new Error('시민권 기간을 표시할 수 없습니다.');
  const currentCityLabel=(currentCitizenRecord.cityName+' ['+currentCitizenRecord.cityId+']').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');
  return currentCityLabel+' · '+CITIZENSHIP_STATUS_LABELS[currentCitizenRecord.status]+' · '+(currentCitizenRecord.source==='initial'?'기본 지급':'유료 발급')+' · '+currentStartDate.toISOString()+' ~ '+currentExpiryDate.toISOString();
 });
 return '시민권 (마지막 서버 조회 기준, UTC)\n'+(currentSummaryLines.join('\n')||'보유 시민권이 없습니다.');
}
