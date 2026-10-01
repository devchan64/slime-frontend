export const EQUIPMENT_SLOT_NAMES = ['main_hand', 'off_hand', 'body', 'back', 'feet', 'tool'];
const EQUIPMENT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isEquipmentIdentifier(currentIdentifierValue) {
  return typeof currentIdentifierValue === 'string' && EQUIPMENT_UUID_PATTERN.test(currentIdentifierValue);
}
function isNonnegativeInteger(currentNumberValue) {
  return Number.isSafeInteger(currentNumberValue) && (currentNumberValue) >= 0;
}
function validateEquipmentInstance(currentInstanceValue) {
  if (!currentInstanceValue || !isEquipmentIdentifier(currentInstanceValue.instanceId)
      || typeof currentInstanceValue.definitionId !== 'string' || !/^[a-z][a-z0-9-]*$/.test(currentInstanceValue.definitionId)
      || !isNonnegativeInteger(currentInstanceValue.definitionVersion) || currentInstanceValue.definitionVersion < 1
      || !isNonnegativeInteger(currentInstanceValue.stateVersion) || currentInstanceValue.stateVersion < 1
      || !EQUIPMENT_SLOT_NAMES.includes(currentInstanceValue.slot)
      || !(currentInstanceValue.equippedSlot === null || currentInstanceValue.equippedSlot === currentInstanceValue.slot)
      || typeof currentInstanceValue.reserved !== 'boolean' || currentInstanceValue.reserved && currentInstanceValue.equippedSlot !== null
      || !isNonnegativeInteger(currentInstanceValue.currentDurability) || !isNonnegativeInteger(currentInstanceValue.maxDurability)
      || currentInstanceValue.currentDurability > currentInstanceValue.maxDurability || !isNonnegativeInteger(currentInstanceValue.weightG)
      || typeof currentInstanceValue.description !== 'string' || !currentInstanceValue.description.trim()
      || typeof currentInstanceValue.nameTranslations?.ko !== 'string' || !currentInstanceValue.nameTranslations.ko.trim()
      || typeof currentInstanceValue.nameTranslations?.en !== 'string' || !currentInstanceValue.nameTranslations.en.trim()
      || !isNonnegativeInteger(currentInstanceValue.statBonus?.attackFlat) || !isNonnegativeInteger(currentInstanceValue.statBonus?.defenseFlat)) {
    throw new Error('장비 개체 응답이 올바르지 않습니다.');
  }
}
export function parseEquipmentInventory(rawEquipmentResponse) {
  const currentInventoryPage = rawEquipmentResponse;
  if (!currentInventoryPage || !Number.isFinite(currentInventoryPage.serverTime)
      || !isNonnegativeInteger(currentInventoryPage.characterVersion) || !isNonnegativeInteger(currentInventoryPage.knownEquipmentWeightG)
      || !Array.isArray(currentInventoryPage.items) || !currentInventoryPage.slots || typeof currentInventoryPage.slots !== 'object'
      || Array.isArray(currentInventoryPage.slots) || !(currentInventoryPage.nextCursor === null || isEquipmentIdentifier(currentInventoryPage.nextCursor))) {
    throw new Error('장비 목록 응답이 올바르지 않습니다.');
  }
  const inventoryInstanceIdentifiers = new Set();
  for (const currentInstanceEntry of currentInventoryPage.items) {
    validateEquipmentInstance(currentInstanceEntry);
    if (inventoryInstanceIdentifiers.has(currentInstanceEntry.instanceId)) throw new Error('장비 개체 ID가 중복되었습니다.');
    inventoryInstanceIdentifiers.add(currentInstanceEntry.instanceId);
  }
  for (const [currentSlotName, currentInstanceEntry] of Object.entries(currentInventoryPage.slots)) {
    validateEquipmentInstance(currentInstanceEntry);
    if (!EQUIPMENT_SLOT_NAMES.includes(currentSlotName) || currentInstanceEntry.equippedSlot !== currentSlotName) {
      throw new Error('장착 슬롯 응답이 올바르지 않습니다.');
    }
  }
  return currentInventoryPage;
}

