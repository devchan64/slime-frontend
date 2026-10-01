import {EQUIPMENT_SLOT_NAMES} from './equipment-validation.mjs';
export const EQUIPMENT_HISTORY_KINDS = ['ACQUIRED','EQUIPPED','UNEQUIPPED','REPAIR_RESERVED','REPAIRED','WORN'];
function validateHistorySnapshot(currentSnapshotValue) {
  if (!currentSnapshotValue || typeof currentSnapshotValue.ownerCharacterId !== 'string'
      || !Number.isSafeInteger(currentSnapshotValue.stateVersion) || currentSnapshotValue.stateVersion<1
      || !Number.isSafeInteger(currentSnapshotValue.currentDurability) || currentSnapshotValue.currentDurability<0
      || !Number.isSafeInteger(currentSnapshotValue.maxDurability) || currentSnapshotValue.maxDurability<currentSnapshotValue.currentDurability
      || typeof currentSnapshotValue.reserved !== 'boolean'
      || !(currentSnapshotValue.equippedSlot===null || EQUIPMENT_SLOT_NAMES.some(currentSlotName=>currentSlotName===currentSnapshotValue.equippedSlot))) {
    throw new Error('장비 이력 상태가 올바르지 않습니다.');
  }
}
export function parseEquipmentHistory(currentResponseValue,requestedInstanceIdentifier) {
  const currentHistoryPage=currentResponseValue;
  if (!currentHistoryPage || currentHistoryPage.instanceId!==requestedInstanceIdentifier || !Array.isArray(currentHistoryPage.items)
      || !(currentHistoryPage.nextBefore===null || Number.isSafeInteger(currentHistoryPage.nextBefore) && currentHistoryPage.nextBefore>0)) {
    throw new Error('장비 이력 응답이 올바르지 않습니다.');
  }
  const currentRecordIdentifiers=new Set();
  let previousRecordVersion=Number.POSITIVE_INFINITY;
  for(const currentHistoryRecord of currentHistoryPage.items) {
    if (!currentHistoryRecord || typeof currentHistoryRecord.recordId!=='string' || !currentHistoryRecord.recordId
        || currentRecordIdentifiers.has(currentHistoryRecord.recordId) || !EQUIPMENT_HISTORY_KINDS.includes(currentHistoryRecord.kind)
        || typeof currentHistoryRecord.sourceId!=='string' || !Number.isFinite(currentHistoryRecord.createdAt)) {
      throw new Error('장비 이력 항목이 올바르지 않습니다.');
    }
    validateHistorySnapshot(currentHistoryRecord.after);
    if(currentHistoryRecord.before!==null) validateHistorySnapshot(currentHistoryRecord.before);
    if(currentHistoryRecord.after.stateVersion>=previousRecordVersion) throw new Error('장비 이력 순서가 올바르지 않습니다.');
    previousRecordVersion=currentHistoryRecord.after.stateVersion;
    currentRecordIdentifiers.add(currentHistoryRecord.recordId);
  }
  return currentHistoryPage;
}
