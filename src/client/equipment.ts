import {LocalizedError} from './notice';

import {EQUIPMENT_SLOT_NAMES} from './equipment-validation.mjs';
export {EQUIPMENT_SLOT_NAMES,parseEquipmentInventory} from './equipment-validation.mjs';
export type EquipmentSlotName = typeof EQUIPMENT_SLOT_NAMES[number];
export type EquipmentInstanceEntry = {
  instanceId: string; definitionId: string; definitionVersion: number; stateVersion: number;
  nameTranslations: {ko: string; en: string}; description: string; slot: EquipmentSlotName;
  equippedSlot: EquipmentSlotName | null; reserved: boolean;
  currentDurability: number; maxDurability: number; weightG: number;
  statBonus: {attackFlat: number; defenseFlat: number};
};
export type EquipmentActionPointSummary = {policyVersion:1;totalWeightG:number;baseMaxAp:number;penaltyAp:number;effectiveMaxAp:number};
export type EquipmentInventoryPage = {
  actionPoints?:EquipmentActionPointSummary;
  equipActionPoints?:Record<string,EquipmentActionPointSummary>;
  unequipActionPoints?:Partial<Record<EquipmentSlotName,EquipmentActionPointSummary>>;
  serverTime: number; characterVersion: number; items: EquipmentInstanceEntry[];
  slots: Partial<Record<EquipmentSlotName, EquipmentInstanceEntry>>;
  knownEquipmentWeightG: number; nextCursor: string | null;
};
export type EquipmentLoadoutCommand = {
  requestId: string; expectedVersion: number; slot: EquipmentSlotName;
  instanceId: string | null; expectedInstanceVersion: number | null;
};
/** 다른 시점의 장비 상태를 하나의 목록으로 합치지 않는다. */
export function mergeEquipmentInventoryPages(previousInventoryPage: EquipmentInventoryPage | null,
  receivedInventoryPage: EquipmentInventoryPage, requestedPageCursor?: string): EquipmentInventoryPage {
  if (!requestedPageCursor) return receivedInventoryPage;
  if (!previousInventoryPage || previousInventoryPage.nextCursor !== requestedPageCursor
      || previousInventoryPage.characterVersion !== receivedInventoryPage.characterVersion)
    throw new LocalizedError('equipment.inventoryChanged');
  const previousInstanceIdentifiers = new Set(previousInventoryPage.items.map(currentItemEntry => currentItemEntry.instanceId));
  if (receivedInventoryPage.items.some(currentItemEntry => previousInstanceIdentifiers.has(currentItemEntry.instanceId)))
    throw new LocalizedError('equipment.inventoryChanged');
  return {...receivedInventoryPage, ...(receivedInventoryPage.equipActionPoints?{equipActionPoints:{...previousInventoryPage.equipActionPoints,...receivedInventoryPage.equipActionPoints}}:{}), items:[...previousInventoryPage.items, ...receivedInventoryPage.items]};
}
