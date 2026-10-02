import type {EquipmentInventoryPage} from './equipment';
export const EQUIPMENT_SLOT_NAMES:readonly ['main_hand','off_hand','body','back','feet','tool'];
export function parseEquipmentInventory(currentResponseValue:unknown):EquipmentInventoryPage;

export function formatEquipmentItemName(currentItemEntry:import('./equipment').EquipmentInstanceEntry,currentLanguageCode:'ko'|'en'):string;
