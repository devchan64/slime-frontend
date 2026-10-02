import {MISSION_REQUEST_ID_PATTERN,validateMissionCancellation,validateMissionPage} from '../src/client/refining-mission-validation.mjs';
const MISSION_STATUS_LABELS={ACTIVE:'진행 중',CANCELLED:'취소',COMPLETED:'완료'};
const MISSION_GUIDANCE_TEXT='취소하면 담보금은 반환되지 않으며 완료 보수도 지급되지 않습니다. 위탁 물품은 자동 회수되지 않습니다.';
function captureMissionContext(currentTextClient){return JSON.stringify([currentTextClient.tokens?.user_id,currentTextClient.state?.me.id,currentTextClient.state?.generation,currentTextClient.state?.epoch,currentTextClient.state?.me.version]);}
function sanitizeMissionDisplay(currentTextValue){return currentTextValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
export async function executeRefiningMissionCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentTargetArgument]=currentCommandArguments;
 const currentGameState=currentTextClient.state;
 if(!currentGameState)throw new Error('먼저 로그인하세요.');
 if(currentActionName==='list'){
  if(currentCommandArguments.length>2||(currentTargetArgument!==undefined&&(!/^(0|[1-9][0-9]*)$/.test(currentTargetArgument)||!Number.isSafeInteger(Number(currentTargetArgument)))))throw new Error('missions list [조회위치]');
  currentTextClient.refiningMissionContext=null;
  const currentPageOffset=Number(currentTargetArgument??0);
  const currentRequestContext=captureMissionContext(currentTextClient);
  const currentResponsePage=await currentTextClient.request('/v1/game/refining-missions?offset='+currentPageOffset);
  if(captureMissionContext(currentTextClient)!==currentRequestContext||currentResponsePage?.characterVersion!==currentGameState.me.version)throw new Error('임무 조회 중 상태가 바뀌었습니다. state 후 다시 조회하세요.');
  validateMissionPage(currentResponsePage,currentGameState.me.id,currentPageOffset);
  currentTextClient.refiningMissionContext={context:currentRequestContext,records:structuredClone(currentResponsePage.entries)};
  const currentDisplayLines=currentResponsePage.entries.map(currentMissionRecord=>{
   const currentMissionQuote=currentMissionRecord.quote,currentRefiningQuote=currentMissionQuote.refining,currentMissionDefinition=currentMissionQuote.definitionSnapshot;
   return `[${currentMissionRecord.requestId}] ${MISSION_STATUS_LABELS[currentMissionRecord.status]} · ${sanitizeMissionDisplay(currentMissionDefinition.missionId)}\n도시 ${sanitizeMissionDisplay(currentMissionDefinition.cityId)} · 전달 NPC ${sanitizeMissionDisplay(currentMissionDefinition.receiverNpcId)} · 위탁 ${sanitizeMissionDisplay(currentMissionDefinition.collectionId)} × ${currentRefiningQuote.inputQuantity}\n결과 ${sanitizeMissionDisplay(currentRefiningQuote.outputMaterial.name)} (${currentRefiningQuote.grade}) × ${currentRefiningQuote.outputQuantity} · 담보 ${currentMissionQuote.deposit.depositP}P · 정제비 ${currentRefiningQuote.costP}P · 정제 ${currentRefiningQuote.durationSeconds}초 · 완료 보수 ${currentMissionQuote.rewardP}P`;
  });
  if(!currentDisplayLines.length)currentDisplayLines.push('정제 임무 기록이 없습니다.');
  if(currentResponsePage.nextOffset!==null)currentDisplayLines.push('다음 조회위치: '+currentResponsePage.nextOffset);
  currentDisplayLines.push(MISSION_GUIDANCE_TEXT,'취소 명령: missions cancel 임무ID');
  return currentDisplayLines.join('\n');
 }
 if(currentActionName!=='cancel'||currentCommandArguments.length!==2||!MISSION_REQUEST_ID_PATTERN.test(currentTargetArgument))throw new Error('missions list [조회위치] / missions cancel 임무ID');
 const currentStoredListing=currentTextClient.refiningMissionContext;
 const currentSelectedMission=currentStoredListing?.records.find(currentMissionRecord=>currentMissionRecord.requestId===currentTargetArgument);
 if(!currentSelectedMission||currentStoredListing.context!==captureMissionContext(currentTextClient))throw new Error('현재 상태에서 missions list로 취소 조건과 임무를 먼저 확인하세요.');
 if(currentSelectedMission.status!=='ACTIVE')throw new Error('진행 중인 정제 임무만 취소할 수 있습니다.');
 if(currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우를 종료한 뒤 정제 임무를 취소하세요.');
 currentTextClient.refiningMissionContext=null;
 return currentTextClient.command('/v1/game/refining-missions/'+currentTargetArgument+'/cancel',{},()=> '정제 임무를 취소했습니다. '+MISSION_GUIDANCE_TEXT,{
  includeRequestIdentifier:false,
  validateCommandResponse(currentCommandResult){
   validateMissionCancellation(currentCommandResult?.receipt,currentSelectedMission,currentGameState.me.id);
  }
 });
}
