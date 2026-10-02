import {parseTimedEventPage,validateTimedEventAction} from '../src/client/timed-event-validation.mjs';
import {parseNpcDialogue} from '../src/client/npc-dialogue-validation.mjs';
const TIMED_OFFER_IDENTIFIER_PATTERN=/^(random|season):[a-zA-Z0-9_-]+:[a-z][a-z0-9-]*$/;
const NPC_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const NPC_REASON_LABELS={GIVER_REQUIRED:'수령 NPC를 방문하세요',RECEIVER_REQUIRED:'전달 NPC를 방문하세요',PREREQUISITE_REQUIRED:'선행 의뢰가 필요합니다',QUEST_LIMIT_REACHED:'동시 수령 한도입니다',MATERIALS_REQUIRED:'재료가 부족합니다',CITIZENSHIP_REQUIRED:'해당 도시의 유효한 시민권이 필요합니다. 현지 모험가 길드에서 발급받으세요. 시민권이 없어도 길드에 재료를 팔아 발급 비용을 마련할 수 있습니다.'};
function sanitizeDialogueText(currentTextValue){return currentTextValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function captureDialogueContext(currentGameState){return JSON.stringify([currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map?.id,currentGameState.me.position?.column,currentGameState.me.position?.row,currentGameState.me.version]);}
export async function executeNpcCommand(currentTextClient,currentCommandName,currentCommandArguments){
 if(currentCommandName==='npc'&&currentCommandArguments.length===1&&currentCommandArguments[0]==='list'){
  const currentBuildingEntries=currentTextClient.state?.map?.buildings;
  if(!Array.isArray(currentBuildingEntries))throw new Error('현재 맵의 건물 정보가 없습니다. state로 확인하세요.');
  return currentBuildingEntries.flatMap(currentBuildingEntry=>(currentBuildingEntry.npcs??[]).map(currentNpcEntry=>{
   if(typeof currentNpcEntry.name!=='string'||typeof currentNpcEntry.id!=='string'||!NPC_IDENTIFIER_PATTERN.test(currentNpcEntry.id)
     ||![currentBuildingEntry.entrance?.column,currentBuildingEntry.entrance?.row].every(currentCoordinateValue=>Number.isSafeInteger(currentCoordinateValue)&&currentCoordinateValue>=0))throw new Error('NPC 목록 정보가 올바르지 않습니다.');
   return sanitizeDialogueText(currentNpcEntry.name)+' ['+currentNpcEntry.id+'] 입구 ('+currentBuildingEntry.entrance.column+','+currentBuildingEntry.entrance.row+')';
  })).join('\n')||'현재 맵에 등록된 NPC가 없습니다.';
 }
 const [currentActionName,currentNpcIdentifier,currentEventIdentifier]=currentCommandArguments;
 if(currentCommandName==='npc'?(!['talk','timed'].includes(currentActionName)||currentActionName==='talk'&&currentCommandArguments.length!==2||currentActionName==='timed'&&!(currentCommandArguments.length===2||currentCommandArguments.length===3&&/^\d+$/.test(currentEventIdentifier)&&Number.isSafeInteger(Number(currentEventIdentifier)))):(currentCommandArguments.length!==3||!['accept','complete'].includes(currentActionName)||!(NPC_IDENTIFIER_PATTERN.test(currentEventIdentifier)||TIMED_OFFER_IDENTIFIER_PATTERN.test(currentEventIdentifier))))throw new Error('npc list / npc talk NPC_ID / quest accept NPC_ID 의뢰ID / quest complete NPC_ID 의뢰ID로 입력하세요.');
 if(typeof currentNpcIdentifier!=='string'||!NPC_IDENTIFIER_PATTERN.test(currentNpcIdentifier))throw new Error('올바른 NPC ID를 입력하세요.');
 const currentGameState=currentTextClient.state;
 if(currentGameState?.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우가 없는 필드에서 NPC를 만나세요.');
 const currentDialogueContext=captureDialogueContext(currentGameState);
 if(currentCommandName==='npc'){
  currentTextClient.npcDialoguePage=null;
  const currentDialoguePage=currentActionName==='timed'?parseTimedEventPage(await currentTextClient.request('/v1/game/npcs/'+encodeURIComponent(currentNpcIdentifier)+'/timed-events?language=ko&offset='+(currentEventIdentifier??'0'))):parseNpcDialogue(await currentTextClient.request('/v1/game/npcs/'+encodeURIComponent(currentNpcIdentifier)+'/main-events?language=ko&includeDestination=true'));
  if(currentDialoguePage.npc?.id!==currentNpcIdentifier||currentDialoguePage.npc.cityId!==currentGameState.map.id||captureDialogueContext(currentTextClient.state)!==currentDialogueContext||currentDialoguePage.characterVersion!==currentGameState.me.version)throw new Error('대화 대상 또는 상태가 변경되었습니다. state 조회 후 다시 대화하세요.');
  currentTextClient.npcDialoguePage={context:currentDialogueContext,data:currentDialoguePage};
  return sanitizeDialogueText(currentDialoguePage.npc.name)+' · 수령 '+currentDialoguePage.acceptedCount+'/'+currentDialoguePage.maximumAcceptedCount+'\n'+currentDialoguePage.entries.map(currentQuestEntry=>[
   sanitizeDialogueText(currentQuestEntry.title)+' ['+sanitizeDialogueText(currentQuestEntry.offerId??currentQuestEntry.eventId)+']',sanitizeDialogueText(currentQuestEntry.dialogue),
   ...(currentQuestEntry.destination?.cityNameTranslations?['전달처: '+sanitizeDialogueText(currentQuestEntry.destination.cityNameTranslations.ko)+' · '+sanitizeDialogueText(currentQuestEntry.destination.name)+' ['+sanitizeDialogueText(currentQuestEntry.destination.npcId)+']']:[]),
   ...(currentQuestEntry.destination?.cityNameTranslations&&currentQuestEntry.status!=='COMPLETED'?['완료하려면 '+sanitizeDialogueText(currentQuestEntry.destination.cityNameTranslations.ko)+'의 유효한 시민권이 필요합니다. 현지 모험가 길드에서 시민권을 발급받을 수 있으며, 시민권이 없어도 재료를 팔아 발급 비용을 마련할 수 있습니다.']:[]),
   ...(currentQuestEntry.offerId?['전달처: '+sanitizeDialogueText(currentQuestEntry.destination.name),'수령 마감: '+new Date(currentQuestEntry.acceptanceEndsAt*1000).toISOString(),currentQuestEntry.acceptedAt===null&&currentQuestEntry.type==='random'?'수령 후 24시간 내 전달':'전달 마감: '+new Date(currentQuestEntry.deliveryDeadline*1000).toISOString(),...(currentQuestEntry.status==='EXPIRED'?['기한 만료 · 보상 없음']:[])]:[]),
   ...currentQuestEntry.items.map(currentMaterialEntry=>sanitizeDialogueText(currentMaterialEntry.nameTranslations.ko)+': '+currentMaterialEntry.owned+'/'+currentMaterialEntry.required),
   (currentQuestEntry.status==='COMPLETED'?'완료 보상 ':'완료 시 재료 차감 · 보상 ')+currentQuestEntry.moneyP+'P',
   ...currentQuestEntry.blockedReasons.map(currentReasonCode=>NPC_REASON_LABELS[currentReasonCode]),
   currentQuestEntry.canExecute?'확정: quest '+currentQuestEntry.action+' '+currentNpcIdentifier+' '+sanitizeDialogueText(currentQuestEntry.offerId??currentQuestEntry.eventId):currentQuestEntry.status==='COMPLETED'?'완료한 의뢰':'현재 실행할 수 없습니다.',
  ].join('\n')).join('\n\n')+(currentDialoguePage.nextOffset!==undefined&&currentDialoguePage.nextOffset!==null?'\n다음 목록: npc timed '+currentNpcIdentifier+' '+currentDialoguePage.nextOffset:'');
 }
 const currentSavedDialogue=currentTextClient.npcDialoguePage;
 const currentQuestEntry=currentSavedDialogue?.data.entries.find(currentQuestEntry=>(currentQuestEntry.offerId??currentQuestEntry.eventId)===currentEventIdentifier);
 if(!currentSavedDialogue||currentSavedDialogue.context!==currentDialogueContext||currentSavedDialogue.data.npc.id!==currentNpcIdentifier||!currentQuestEntry?.canExecute||currentQuestEntry.action!==currentActionName)throw new Error('npc talk로 현재 조건·재료·보상을 먼저 확인하세요.');
 currentTextClient.npcDialoguePage=null;
 // 이 API는 requestId를 받지 않는다. 불명확한 결과는 journal/대화 조회로 확인한다.
 const currentActionResponse=await currentTextClient.request('/v1/game/'+(currentQuestEntry.offerId?'timed-events':'main-events')+'/'+encodeURIComponent(currentEventIdentifier)+'/'+currentActionName,{npcId:currentNpcIdentifier,expectedVersion:currentSavedDialogue.data.characterVersion});
 if(currentQuestEntry.offerId)validateTimedEventAction(currentActionResponse,currentQuestEntry,currentActionName,currentGameState);
 currentTextClient.accept(currentActionResponse.state);
 return currentTextClient.state;
}

export async function executeTimedEventJournal(currentTextClient,currentCommandArguments){
 if(currentCommandArguments.length>1||currentCommandArguments.length===1&&(!/^\d+$/.test(currentCommandArguments[0])||!Number.isSafeInteger(Number(currentCommandArguments[0]))))throw new Error('journal timed [다음 위치]로 입력하세요.');
 const currentReceivedPage=parseTimedEventPage(await currentTextClient.request('/v1/game/timed-events?offset='+(currentCommandArguments[0]??'0')));
 if(currentReceivedPage.npc!==null)throw new Error('개인 의뢰 기록이 아닙니다.');
 return currentReceivedPage.entries.map(currentQuestEntry=>sanitizeDialogueText(currentQuestEntry.title)+' ['+currentQuestEntry.offerId+'] '+currentQuestEntry.status+'\n전달처: '+sanitizeDialogueText(currentQuestEntry.destination.name)+'\n전달 마감: '+new Date(currentQuestEntry.deliveryDeadline*1000).toISOString()+'\n'+(currentQuestEntry.status==='EXPIRED'?'기한 만료 · 보상 없음':'보상 '+currentQuestEntry.moneyP+'P')).join('\n\n')+(currentReceivedPage.nextOffset!==null?'\n다음 기록: journal timed '+currentReceivedPage.nextOffset:'')||'시즌·랜덤 의뢰 기록이 없습니다.';
}
