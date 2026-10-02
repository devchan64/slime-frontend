import {parseNpcDialogue} from './npc-dialogue-validation.mjs';
const TIMED_EVENT_ERROR_TEXT='기간 의뢰 응답이 올바르지 않습니다.';
const TIMED_EVENT_EXTRA_KEYS=['offerId','type','periodId','acceptanceEndsAt','deliveryDeadline','acceptedAt','completedAt'];
const validTimedEventTimestamp=currentTimestampValue=>typeof currentTimestampValue==='number'&&Number.isFinite(currentTimestampValue)&&currentTimestampValue>=0;
export function parseTimedEventPage(currentResponseValue){
 if(!currentResponseValue||typeof currentResponseValue!=='object'||!Array.isArray(currentResponseValue.entries)
   ||Object.keys(currentResponseValue).sort().join(',')!==['serverTime','characterVersion','npc','entries','nextOffset','acceptedCount','maximumAcceptedCount'].sort().join(',')
   ||currentResponseValue.entries.length>50||!(currentResponseValue.nextOffset===null||Number.isSafeInteger(currentResponseValue.nextOffset)&&currentResponseValue.nextOffset>=50))throw new Error(TIMED_EVENT_ERROR_TEXT);
 const currentSeenOffers=new Set();
 const currentProjectedEntries=currentResponseValue.entries.map(currentEntryValue=>{
  if(!currentEntryValue||typeof currentEntryValue!=='object'||!TIMED_EVENT_EXTRA_KEYS.every(currentFieldName=>Object.hasOwn(currentEntryValue,currentFieldName)))throw new Error(TIMED_EVENT_ERROR_TEXT);
  const {offerId:currentOfferIdentifier,type:currentEventKind,periodId:currentPeriodIdentifier,acceptanceEndsAt:currentAcceptanceEnd,deliveryDeadline:currentDeliveryEnd,acceptedAt:currentAcceptedTime,completedAt:currentCompletedTime,...currentBaseEntry}=currentEntryValue;
  if(!['random','season'].includes(currentEventKind)||typeof currentPeriodIdentifier!=='string'||!/^[a-zA-Z0-9_-]+$/.test(currentPeriodIdentifier)
    ||currentOfferIdentifier!==`${currentEventKind}:${currentPeriodIdentifier}:${currentBaseEntry.eventId}`||currentSeenOffers.has(currentOfferIdentifier)
    ||!validTimedEventTimestamp(currentAcceptanceEnd)||!validTimedEventTimestamp(currentDeliveryEnd)
    ||!(currentAcceptedTime===null||validTimedEventTimestamp(currentAcceptedTime)&&currentAcceptedTime<currentAcceptanceEnd)
    ||!(currentCompletedTime===null||validTimedEventTimestamp(currentCompletedTime)&&currentAcceptedTime!==null&&currentCompletedTime>=currentAcceptedTime&&currentCompletedTime<currentDeliveryEnd)
    ||(currentBaseEntry.status==='COMPLETED')!==(currentCompletedTime!==null)
    ||(['AVAILABLE','LOCKED'].includes(currentBaseEntry.status))!==(currentAcceptedTime===null)
    ||currentAcceptedTime!==null&&currentDeliveryEnd!==(currentEventKind==='random'?currentAcceptedTime:currentAcceptanceEnd)+86400
    ||currentBaseEntry.status==='EXPIRED'&&(currentResponseValue.serverTime<currentDeliveryEnd||currentBaseEntry.action!==null||currentBaseEntry.canExecute||currentBaseEntry.blockedReasons?.length)
    ||currentBaseEntry.status==='ACCEPTED'&&currentResponseValue.serverTime>=currentDeliveryEnd)throw new Error(TIMED_EVENT_ERROR_TEXT);
  currentSeenOffers.add(currentOfferIdentifier);
  const currentDestinationValue=currentBaseEntry.destination;
  if(!currentDestinationValue||currentDestinationValue.npcId!==currentBaseEntry.receiverNpcId)throw new Error(TIMED_EVENT_ERROR_TEXT);
  return {...currentBaseEntry,eventId:currentOfferIdentifier,status:currentBaseEntry.status==='EXPIRED'?'COMPLETED':currentBaseEntry.status};
 });
 // 재료·보상·행동 조건의 공통 계약은 기존 NPC 검증기를 사용한다.
 const currentNpcIdentity=currentResponseValue.npc??{id:'journal',name:'journal',cityId:'journal',facilityId:'journal'};
 parseNpcDialogue({serverTime:currentResponseValue.serverTime,characterVersion:currentResponseValue.characterVersion,
  npc:currentNpcIdentity,entries:currentProjectedEntries,acceptedCount:currentResponseValue.acceptedCount,maximumAcceptedCount:currentResponseValue.maximumAcceptedCount});
 return currentResponseValue;
}

export function validateTimedEventAction(currentActionResponse,currentRequestedEntry,currentActionName,currentOriginalState){
 const currentReturnedState=currentActionResponse?.state;
 const currentReturnedEntry=currentActionResponse?.entry;
 if(!currentReturnedState||currentReturnedState.me?.id!==currentOriginalState.me.id||currentReturnedState.generation!==currentOriginalState.generation
   ||!Number.isSafeInteger(currentReturnedState.me.version)||currentReturnedState.me.version<=currentOriginalState.me.version
   ||currentReturnedEntry?.offerId!==currentRequestedEntry.offerId||currentReturnedEntry.moneyP!==currentRequestedEntry.moneyP
   ||currentActionName==='complete'&&(currentReturnedEntry.acceptedAt!==currentRequestedEntry.acceptedAt||currentReturnedEntry.deliveryDeadline!==currentRequestedEntry.deliveryDeadline)
   ||currentReturnedEntry.type!==currentRequestedEntry.type||currentReturnedEntry.periodId!==currentRequestedEntry.periodId
   ||!['ACCEPTED','COMPLETED'].includes(currentReturnedEntry.status)||currentActionName==='complete'&&currentReturnedEntry.status!=='COMPLETED'
   ||JSON.stringify(currentReturnedEntry.items?.map(currentItemEntry=>[currentItemEntry.itemId,currentItemEntry.required]))!==JSON.stringify(currentRequestedEntry.items.map(currentItemEntry=>[currentItemEntry.itemId,currentItemEntry.required])))throw new Error(TIMED_EVENT_ERROR_TEXT);
 parseTimedEventPage({serverTime:currentReturnedState.serverTime,characterVersion:currentReturnedState.me.version,npc:null,
  entries:[currentReturnedEntry],nextOffset:null,acceptedCount:0,maximumAcceptedCount:5});
}
