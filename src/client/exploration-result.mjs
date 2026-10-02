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

export function describeExplorationReward(currentResultRecord,currentBagItems,currentLocaleCode='ko') {
 if(!['ko','en'].includes(currentLocaleCode))throw new Error('지원하지 않는 탐색 표시 언어입니다.');
 const currentRewardRecord=currentResultRecord.reward;
 if(!currentResultRecord.succeeded)return '';
 if(currentRewardRecord.kind==='money')return `${currentRewardRecord.amountP}P`;
 const currentMaterialRecord=currentBagItems?.find(currentBagItem=>currentBagItem.kind==='material'&&currentBagItem.id===currentRewardRecord.itemId);
 const currentMaterialName=currentMaterialRecord?.nameTranslations?.[currentLocaleCode];
 if(typeof currentMaterialName!=='string'||!currentMaterialName.trim())throw new Error('탐색 보상 재료의 표시 이름이 없습니다.');
 return `${currentMaterialName} × ${currentRewardRecord.quantity}`;
}
