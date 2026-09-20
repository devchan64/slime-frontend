import {parseMainEventJournal,type JournalMaterialItem,type JournalNpcIdentity} from './mainEventJournal';
export const NPC_BLOCK_REASON_CODES=['GIVER_REQUIRED','RECEIVER_REQUIRED','PREREQUISITE_REQUIRED','QUEST_LIMIT_REACHED','MATERIALS_REQUIRED','CITIZENSHIP_REQUIRED'] as const;
export type NpcQuestEntry={eventId:string;title:string;status:'AVAILABLE'|'LOCKED'|'ACCEPTED'|'COMPLETED';dialogue:string;
  items:JournalMaterialItem[];moneyP:number;action:'accept'|'complete'|null;canExecute:boolean;blockedReasons:string[];giverNpcId:string;receiverNpcId:string};
export type NpcDialoguePage={serverTime:number;characterVersion:number;npc:JournalNpcIdentity;entries:NpcQuestEntry[];acceptedCount:number;maximumAcceptedCount:number};
const INVALID_DIALOGUE_MESSAGE='NPC 대화 응답이 올바르지 않습니다.';
function requireDialogueRecord(currentRecordValue:any,expectedRecordKeys:string[]) {
  if(!currentRecordValue||typeof currentRecordValue!=='object'||Array.isArray(currentRecordValue)
    ||Object.keys(currentRecordValue).length!==expectedRecordKeys.length||expectedRecordKeys.some(currentRecordKey=>!Object.hasOwn(currentRecordValue,currentRecordKey)))throw new Error(INVALID_DIALOGUE_MESSAGE);
}
export function parseNpcDialogue(currentResponseValue:any):NpcDialoguePage {
  requireDialogueRecord(currentResponseValue,['serverTime','characterVersion','npc','entries','acceptedCount','maximumAcceptedCount']);
  requireDialogueRecord(currentResponseValue.npc,['id','name','cityId','facilityId']);
  if(!Object.values(currentResponseValue.npc).every(currentTextValue=>typeof currentTextValue==='string'&&!!currentTextValue.trim())
    ||!Number.isSafeInteger(currentResponseValue.acceptedCount)||currentResponseValue.acceptedCount<0
    ||!Number.isSafeInteger(currentResponseValue.maximumAcceptedCount)||currentResponseValue.maximumAcceptedCount<1
    ||!Array.isArray(currentResponseValue.entries))throw new Error(INVALID_DIALOGUE_MESSAGE);
  for(const currentQuestEntry of currentResponseValue.entries){
    requireDialogueRecord(currentQuestEntry,['eventId','title','status','dialogue','items','moneyP','action','canExecute','blockedReasons','giverNpcId','receiverNpcId']);
    if(!['AVAILABLE','LOCKED','ACCEPTED','COMPLETED'].includes(currentQuestEntry.status)
      ||![currentQuestEntry.dialogue,currentQuestEntry.giverNpcId,currentQuestEntry.receiverNpcId].every(currentTextValue=>typeof currentTextValue==='string'&&!!currentTextValue.trim())
      ||!Array.isArray(currentQuestEntry.blockedReasons)||new Set(currentQuestEntry.blockedReasons).size!==currentQuestEntry.blockedReasons.length
      ||!currentQuestEntry.blockedReasons.every((currentReasonCode:any)=>NPC_BLOCK_REASON_CODES.includes(currentReasonCode))
      ||currentQuestEntry.action!==(currentQuestEntry.status==='COMPLETED'?null:currentQuestEntry.status==='ACCEPTED'?'complete':'accept')
      ||currentQuestEntry.canExecute!==(currentQuestEntry.action!==null&&currentQuestEntry.blockedReasons.length===0)
      ||(currentQuestEntry.status==='AVAILABLE'&&!currentQuestEntry.canExecute)||(currentQuestEntry.status==='LOCKED'&&currentQuestEntry.canExecute)
      ||(currentQuestEntry.status==='COMPLETED'&&currentQuestEntry.blockedReasons.length))throw new Error(INVALID_DIALOGUE_MESSAGE);
  }
  // 공통 재료·보상·식별자와 중복 검증은 의뢰 기록 계약을 재사용한다.
  parseMainEventJournal({serverTime:currentResponseValue.serverTime,characterVersion:currentResponseValue.characterVersion,
    entries:currentResponseValue.entries.map((currentQuestEntry:NpcQuestEntry)=>({eventId:currentQuestEntry.eventId,title:currentQuestEntry.title,
      acceptedAt:0,completedAt:0,status:'COMPLETED',materialsSufficient:false,moneyP:currentQuestEntry.moneyP,
      giver:currentResponseValue.npc,receiver:currentResponseValue.npc,items:currentQuestEntry.items}))});
  return currentResponseValue;
}
