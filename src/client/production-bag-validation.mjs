// 생산 배치의 공개 식별·레벨 계약을 GUI와 텍스트에서 함께 검증한다.
export function validateProductionBagItem(currentItemEntry){
  const currentBatchFields=['batchId','definitionId','itemLevel','performanceVersion'];
  if(!currentBatchFields.some(currentFieldName=>currentItemEntry[currentFieldName]!==undefined))return;
  if(currentItemEntry.kind!=='consumable'||typeof currentItemEntry.batchId!=='string'||!currentItemEntry.batchId.trim()
      ||currentItemEntry.id!=='production-batch:'+currentItemEntry.batchId
      ||typeof currentItemEntry.definitionId!=='string'||!currentItemEntry.definitionId.trim()
      ||![1,2].includes(currentItemEntry.itemLevel)||!Number.isSafeInteger(currentItemEntry.performanceVersion)||currentItemEntry.performanceVersion<1)
    throw new Error('생산 배치 가방 응답이 올바르지 않습니다.');
}
