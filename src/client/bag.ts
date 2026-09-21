import type { State } from './types';
import { parseEquipmentInventory, type EquipmentInventoryPage } from './equipment';

export type BagInventoryPage = EquipmentInventoryPage & {bag: NonNullable<State['me']['bag']>};
export function parseBagInventory(currentResponseValue: unknown): BagInventoryPage {
  const currentInventoryPage = parseEquipmentInventory(currentResponseValue) as BagInventoryPage;
  const currentBagSummary = currentInventoryPage.bag;
  if (!currentBagSummary || !Array.isArray(currentBagSummary.items)
      || ![currentBagSummary.capacityG,currentBagSummary.knownWeightG,currentBagSummary.unknownWeightQuantity]
        .every(currentNumberValue => Number.isSafeInteger(currentNumberValue) && currentNumberValue >= 0)) {
    throw new Error('가방 합계 응답이 올바르지 않습니다.');
  }
  const currentMaterialIdentifiers = new Set<string>();
  let calculatedKnownWeight = currentInventoryPage.knownEquipmentWeightG;
  let calculatedUnknownQuantity = 0;
  for (const currentMaterialEntry of currentBagSummary.items) {
    if (!currentMaterialEntry || !['material','consumable','skillbook'].includes(currentMaterialEntry.kind) || typeof currentMaterialEntry.id !== 'string'
        || !currentMaterialEntry.id || currentMaterialIdentifiers.has(currentMaterialEntry.id)
        || !Number.isSafeInteger(currentMaterialEntry.quantity) || currentMaterialEntry.quantity < 1
        || typeof currentMaterialEntry.nameTranslations?.ko !== 'string' || typeof currentMaterialEntry.nameTranslations?.en !== 'string'
        || typeof currentMaterialEntry.description !== 'string'
        || !(currentMaterialEntry.weightG === null || Number.isSafeInteger(currentMaterialEntry.weightG) && currentMaterialEntry.weightG >= 0)
        || !(currentMaterialEntry.valueP === null || Number.isSafeInteger(currentMaterialEntry.valueP) && currentMaterialEntry.valueP > 0)) {
      throw new Error('가방 재료 응답이 올바르지 않습니다.');
    }
    if(currentMaterialEntry.kind === 'skillbook' && (currentMaterialEntry.quantity !== 1 || currentMaterialEntry.valueP !== null)) throw new Error('스킬북은 한 권만 소유하며 판매할 수 없습니다.');
    currentMaterialIdentifiers.add(currentMaterialEntry.id);
    if (currentMaterialEntry.useAction !== undefined && (currentMaterialEntry.kind !== 'consumable'
        || !currentMaterialEntry.useAction || !['RESTORE_HP','PLACE_MARKER'].includes(currentMaterialEntry.useAction.type)
        || (currentMaterialEntry.useAction.type === 'RESTORE_HP' && (!Number.isSafeInteger(currentMaterialEntry.useAction.restorationHp) || currentMaterialEntry.useAction.restorationHp < 1))
        || (currentMaterialEntry.useAction.type === 'PLACE_MARKER' && (!['ROUTE','LIGHT'].includes(currentMaterialEntry.useAction.markerKind)
          || !Number.isSafeInteger(currentMaterialEntry.useAction.validSeconds) || currentMaterialEntry.useAction.validSeconds < 1))
        || !Number.isSafeInteger(currentMaterialEntry.useAction.consumedOnSuccess) || currentMaterialEntry.useAction.consumedOnSuccess < 1)) {
      throw new Error('소모품 사용 응답이 올바르지 않습니다.');
    }
    if (currentMaterialEntry.weightG === null) calculatedUnknownQuantity += currentMaterialEntry.quantity;
    else calculatedKnownWeight += currentMaterialEntry.quantity * currentMaterialEntry.weightG;
  }
  if (calculatedKnownWeight !== currentBagSummary.knownWeightG || calculatedUnknownQuantity !== currentBagSummary.unknownWeightQuantity) {
    throw new Error('가방 합계와 소지품 정보가 일치하지 않습니다.');
  }
  return currentInventoryPage;
}
