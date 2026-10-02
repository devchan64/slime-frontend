import {isDeepStrictEqual} from 'node:util';
const MISSION_REQUEST_ID_PATTERN=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MISSION_STATUS_LABELS={ACTIVE:'진행 중',CANCELLED:'취소',COMPLETED:'완료'};
const MISSION_GUIDANCE_TEXT='취소하면 담보금은 반환되지 않으며 완료 보수도 지급되지 않습니다. 위탁 물품은 자동 회수되지 않습니다.';
function captureMissionContext(currentTextClient){return JSON.stringify([currentTextClient.tokens?.user_id,currentTextClient.state?.me.id,currentTextClient.state?.generation,currentTextClient.state?.epoch,currentTextClient.state?.me.version]);}
function isMissionPositiveInteger(currentNumberValue){return Number.isSafeInteger(currentNumberValue)&&currentNumberValue>0;}
function sanitizeMissionDisplay(currentTextValue){return currentTextValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
export function validateMissionRecord(currentMissionRecord,currentCharacterIdentifier){
 const currentMissionQuote=currentMissionRecord?.quote;
 const currentMissionDefinition=currentMissionQuote?.definitionSnapshot;
 const currentRefiningQuote=currentMissionQuote?.refining;
 if(!currentMissionRecord||currentMissionRecord.characterId!==currentCharacterIdentifier||!MISSION_REQUEST_ID_PATTERN.test(currentMissionRecord.requestId)
  ||!Object.hasOwn(MISSION_STATUS_LABELS,currentMissionRecord.status)||!Number.isFinite(currentMissionRecord.acceptedAt)||currentMissionRecord.acceptedAt<0
  ||!currentMissionDefinition||!['missionId','cityId','receiverNpcId','collectionId'].every(currentFieldName=>typeof currentMissionDefinition[currentFieldName]==='string'&&currentMissionDefinition[currentFieldName].trim())
  ||!isMissionPositiveInteger(currentMissionQuote.deposit?.depositP)||!isMissionPositiveInteger(currentMissionQuote.rewardP)
  ||!currentRefiningQuote||!isMissionPositiveInteger(currentRefiningQuote.inputQuantity)||!isMissionPositiveInteger(currentRefiningQuote.outputQuantity)
  ||!isMissionPositiveInteger(currentRefiningQuote.costP)||!isMissionPositiveInteger(currentRefiningQuote.durationSeconds)
  ||!['low','medium','high'].includes(currentRefiningQuote.grade)||typeof currentRefiningQuote.outputMaterial?.name!=='string'||!currentRefiningQuote.outputMaterial.name.trim()
  ||currentMissionDefinition.collectionId!==currentRefiningQuote.collectionId||currentMissionDefinition.grade!==currentRefiningQuote.grade
  ||currentMissionDefinition.quantity!==currentRefiningQuote.outputQuantity||currentMissionDefinition.rewardP!==currentMissionQuote.rewardP)throw new Error('정제 임무 기록이 올바르지 않습니다.');
 const currentTerminalField=currentMissionRecord.status==='CANCELLED'?'cancelledAt':currentMissionRecord.status==='COMPLETED'?'completedAt':null;
 for(const currentFieldName of ['cancelledAt','completedAt']){
  const currentTimestampValue=currentMissionRecord[currentFieldName];
  if(currentFieldName===currentTerminalField?(!Number.isFinite(currentTimestampValue)||currentTimestampValue<currentMissionRecord.acceptedAt):currentTimestampValue!=null)throw new Error('정제 임무 종료 시각이 올바르지 않습니다.');
 }
 return currentMissionRecord;
}
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
  if(!Array.isArray(currentResponsePage.entries)||currentResponsePage.entries.length>50||!Number.isFinite(currentResponsePage.serverTime)
   ||!(currentResponsePage.nextOffset===null||Number.isSafeInteger(currentResponsePage.nextOffset)&&currentResponsePage.nextOffset===currentPageOffset+50&&currentResponsePage.entries.length===50))throw new Error('정제 임무 목록 응답이 올바르지 않습니다.');
  const currentSeenIdentifiers=new Set();
  for(const currentMissionRecord of currentResponsePage.entries){
   validateMissionRecord(currentMissionRecord,currentGameState.me.id);
   if(currentSeenIdentifiers.has(currentMissionRecord.requestId))throw new Error('정제 임무가 중복되었습니다.');
   currentSeenIdentifiers.add(currentMissionRecord.requestId);
  }
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
   const currentReceiptRecord=validateMissionRecord(currentCommandResult?.receipt,currentGameState.me.id);
   if(currentReceiptRecord.requestId!==currentTargetArgument||currentReceiptRecord.status!=='CANCELLED'||currentReceiptRecord.acceptedAt!==currentSelectedMission.acceptedAt
    ||!isDeepStrictEqual(currentReceiptRecord.quote,currentSelectedMission.quote))throw new Error('정제 임무 취소 영수증이 요청과 다릅니다.');
  }
 });
}
