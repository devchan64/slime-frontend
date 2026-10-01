import {parseEquipmentHistory} from '../src/client/equipment-history-validation.mjs';
import {parseEquipmentInventory,EQUIPMENT_SLOT_NAMES} from '../src/client/equipment-validation.mjs';
const EQUIPMENT_HISTORY_LABELS={ACQUIRED:'획득',EQUIPPED:'장착',UNEQUIPPED:'해제',REPAIR_RESERVED:'수리 예약',REPAIRED:'수리 완료',WORN:'전투 마모'};
const EQUIPMENT_IDENTIFIER_PATTERN=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function captureEquipmentContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState?.me.id,currentGameState?.generation,currentGameState?.epoch,currentGameState?.me.version]);
}
export async function executeEquipmentCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentTargetIdentifier,currentBeforeVersionText]=currentCommandArguments;
 if(currentActionName==='history'){
  if(currentCommandArguments.length<2||currentCommandArguments.length>3||!EQUIPMENT_IDENTIFIER_PATTERN.test(currentTargetIdentifier)
   ||(currentBeforeVersionText!==undefined&&(!/^[1-9][0-9]*$/.test(currentBeforeVersionText)||!Number.isSafeInteger(Number(currentBeforeVersionText)))))throw new Error('equipment history 개체ID [이전버전]');
  const currentHistoryContext=captureEquipmentContext(currentTextClient);
  const currentHistoryOwner=currentTextClient.state?.me.id;
  const currentHistoryPage=parseEquipmentHistory(await currentTextClient.request('/v1/game/equipment/'+currentTargetIdentifier+'/history'+(currentBeforeVersionText?'?before='+currentBeforeVersionText:'')),currentTargetIdentifier);
  if(captureEquipmentContext(currentTextClient)!==currentHistoryContext)throw new Error('장비 이력 조회 중 캐릭터·세션·상태가 바뀌었습니다. 다시 조회하세요.');
  const currentHistoryLines=currentHistoryPage.items.map(currentHistoryRecord=>{
   if(currentHistoryRecord.after.ownerCharacterId!==currentHistoryOwner||(currentHistoryRecord.before!==null&&currentHistoryRecord.before.ownerCharacterId!==currentHistoryOwner)
    ||(currentBeforeVersionText&&currentHistoryRecord.after.stateVersion>=Number(currentBeforeVersionText)))throw new Error('장비 이력의 소유자 또는 페이지 범위가 일치하지 않습니다.');
   const currentHistoryDate=new Date(currentHistoryRecord.createdAt*1000);
   if(!Number.isFinite(currentHistoryDate.getTime())||currentHistoryRecord.createdAt<0)throw new Error('장비 이력 시각이 올바르지 않습니다.');
   return EQUIPMENT_HISTORY_LABELS[currentHistoryRecord.kind]+' · '+currentHistoryDate.toISOString()+' · v'+currentHistoryRecord.after.stateVersion+' · 내구도 '+(currentHistoryRecord.before?currentHistoryRecord.before.currentDurability+'/'+currentHistoryRecord.before.maxDurability+' → ':'')+currentHistoryRecord.after.currentDurability+'/'+currentHistoryRecord.after.maxDurability;
  });
  if(currentHistoryPage.nextBefore!==null){
   if(currentHistoryPage.nextBefore!==currentHistoryPage.items.at(-1)?.after.stateVersion)throw new Error('장비 이력의 다음 페이지 기준이 올바르지 않습니다.');
   currentHistoryLines.push('다음 이전버전: '+currentHistoryPage.nextBefore);
  }
  return currentHistoryLines.join('\n')||'보존된 장비 이력이 없습니다. 과거 기록을 추정해 복원하지 않습니다.';
 }
 if(!(['list','equip','unequip'].includes(currentActionName)&&currentCommandArguments.length<3
  &&(currentActionName==='list'?currentTargetIdentifier===undefined||EQUIPMENT_IDENTIFIER_PATTERN.test(currentTargetIdentifier):currentTargetIdentifier!==undefined)))throw new Error('equipment list [다음커서] / equip 개체ID / unequip 슬롯');
 const currentEquipmentContext=captureEquipmentContext(currentTextClient);
 if(currentActionName==='list'){
  currentTextClient.equipmentInventoryContext=null;
  const currentInventoryPage=parseEquipmentInventory(await currentTextClient.request('/v1/game/equipment'+(currentTargetIdentifier?'?after='+currentTargetIdentifier:'')));
  if(captureEquipmentContext(currentTextClient)!==currentEquipmentContext||currentInventoryPage.characterVersion!==currentTextClient.state?.me.version)throw new Error('장비 조회 중 상태가 바뀌었습니다. state 후 다시 조회하세요.');
  currentTextClient.equipmentInventoryContext={context:currentEquipmentContext,page:currentInventoryPage};
  const currentEquipmentLines=currentInventoryPage.items.map(currentItemEntry=>currentItemEntry.nameTranslations.ko.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ')+' ['+currentItemEntry.instanceId+'] '+currentItemEntry.slot+' · 내구도 '+currentItemEntry.currentDurability+'/'+currentItemEntry.maxDurability+' · '+(currentItemEntry.reserved?'예약 중':currentItemEntry.equippedSlot?'장착 중':'미장착'));
  currentEquipmentLines.push('장착 슬롯: '+EQUIPMENT_SLOT_NAMES.map(currentSlotName=>currentSlotName+'='+(currentInventoryPage.slots[currentSlotName]?.instanceId??'없음')).join(', '));
  if(currentInventoryPage.nextCursor)currentEquipmentLines.push('다음커서: '+currentInventoryPage.nextCursor);
  return currentEquipmentLines.join('\n');
 }
 const currentStoredInventory=currentTextClient.equipmentInventoryContext;
 if(!currentStoredInventory||currentStoredInventory.context!==currentEquipmentContext)throw new Error('현재 상태에서 equipment list로 장비를 먼저 조회하세요.');
 if(currentTextClient.state.me.mode!=='FIELD'||currentTextClient.state.battle||currentTextClient.state.reservation)throw new Error('전투·조우를 종료한 뒤 장비를 변경하세요.');
 let currentRequestedSlot,currentSelectedInstance;
 if(currentActionName==='equip'){
  if(!EQUIPMENT_IDENTIFIER_PATTERN.test(currentTargetIdentifier))throw new Error('조회한 장비 개체 ID를 입력하세요.');
  currentSelectedInstance=currentStoredInventory.page.items.find(currentItemEntry=>currentItemEntry.instanceId===currentTargetIdentifier);
  if(!currentSelectedInstance||currentSelectedInstance.reserved)throw new Error('조회한 장비 중 예약되지 않은 장비를 선택하세요.');
  currentRequestedSlot=currentSelectedInstance.slot;
 }else{
  if(!EQUIPMENT_SLOT_NAMES.includes(currentTargetIdentifier))throw new Error('목록에 표시된 장비 슬롯을 입력하세요.');
  currentRequestedSlot=currentTargetIdentifier;
 }
 currentTextClient.equipmentInventoryContext=null;
 return currentTextClient.command('/v1/game/equipment/loadout',{slot:currentRequestedSlot,instanceId:currentSelectedInstance?.instanceId??null,expectedInstanceVersion:currentSelectedInstance?.stateVersion??null},()=> '장비 변경 완료. equipment list로 최신 장비를 조회하세요.',{
  fetchStateAfterReceipt:true,readReceiptCharacterVersion:currentCommandResult=>currentCommandResult.characterVersion,
  validateCommandResponse(currentCommandResult,currentRequestBody){
   if(!currentCommandResult||currentCommandResult.slot!==currentRequestBody.slot||currentCommandResult.instanceId!==currentRequestBody.instanceId
    ||typeof currentCommandResult.changed!=='boolean'||!Number.isSafeInteger(currentCommandResult.characterVersion)
    ||currentCommandResult.characterVersion!==currentRequestBody.expectedVersion+Number(currentCommandResult.changed)
    ||(currentRequestBody.instanceId===null?currentCommandResult.instanceVersion!==null:currentCommandResult.instanceVersion!==currentRequestBody.expectedInstanceVersion+Number(currentCommandResult.changed)))throw new Error('장비 변경 영수증이 요청과 일치하지 않습니다.');
  }
 });
}
