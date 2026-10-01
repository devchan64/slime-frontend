import {parseEquipmentInventory,EQUIPMENT_SLOT_NAMES} from '../src/client/equipment-validation.mjs';
const EQUIPMENT_IDENTIFIER_PATTERN=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function captureEquipmentContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState?.me.id,currentGameState?.generation,currentGameState?.epoch,currentGameState?.me.version]);
}
export async function executeEquipmentCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentTargetIdentifier]=currentCommandArguments;
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
