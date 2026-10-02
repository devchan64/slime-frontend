export function validateExplorationResult(currentResultRecord, currentMapIdentifier, currentResourceKind, currentTargetPosition) {
 if(!currentResultRecord||currentResultRecord.mapId!==currentMapIdentifier||currentResultRecord.resourceKind!==currentResourceKind||
    currentResultRecord.position?.column!==currentTargetPosition.column||currentResultRecord.position?.row!==currentTargetPosition.row||
    typeof currentResultRecord.succeeded!=='boolean'||!Number.isSafeInteger(currentResultRecord.fpCost)||currentResultRecord.fpCost<1||
    !Number.isFinite(currentResultRecord.nextAttemptAt)||currentResultRecord.nextAttemptAt<0)throw new Error('탐색 결과가 요청과 일치하지 않습니다.');
 const currentRewardRecord=currentResultRecord.reward;
 if(!currentResultRecord.succeeded){if(currentRewardRecord!==null)throw new Error('실패한 탐색에 보상이 있습니다.');}
 else if(currentResourceKind==='mineral'){
  if(currentRewardRecord?.kind!=='material'||typeof currentRewardRecord.itemId!=='string'||!currentRewardRecord.itemId||!Number.isSafeInteger(currentRewardRecord.quantity)||currentRewardRecord.quantity<1)throw new Error('광물 보상이 올바르지 않습니다.');
 }else if(currentRewardRecord?.kind!=='money'||!Number.isSafeInteger(currentRewardRecord.amountP)||currentRewardRecord.amountP<1)throw new Error('보물 보상이 올바르지 않습니다.');
 return currentResultRecord;
}
