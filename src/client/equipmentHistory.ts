import {EQUIPMENT_HISTORY_KINDS} from './equipment-history-validation.mjs';
export {EQUIPMENT_HISTORY_KINDS,parseEquipmentHistory} from './equipment-history-validation.mjs';
export type EquipmentHistorySnapshot = {ownerCharacterId:string; stateVersion:number; currentDurability:number; maxDurability:number; equippedSlot:string|null; reserved:boolean; retiredAt?:number|null};
export type EquipmentHistoryPage = {instanceId:string; nextBefore:number|null; items:Array<{
  recordId:string; kind:typeof EQUIPMENT_HISTORY_KINDS[number]; sourceId:string;
  before:EquipmentHistorySnapshot|null; after:EquipmentHistorySnapshot; createdAt:number;
}>};
