import type {EquipmentHistoryPage} from './equipmentHistory';
export const EQUIPMENT_HISTORY_KINDS:readonly ['ACQUIRED','EQUIPPED','UNEQUIPPED','REPAIR_RESERVED','REPAIRED','WORN'];
export function parseEquipmentHistory(currentResponseValue:unknown,requestedInstanceIdentifier:string):EquipmentHistoryPage;
