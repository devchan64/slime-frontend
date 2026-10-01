import {parseSubstituteHuntCatalog,parseSubstituteHuntReceipt} from '../src/client/substitute-hunt-validation.mjs';
const SUBSTITUTE_HUNT_REASONS={INVALID_STATE:'현재 상태에서 실행 불가',FIRST_HUNT_REQUIRED:'첫 사냥 업적 필요',INSUFFICIENT_FP:'FP 부족'};
export async function executeSubstituteHuntCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentEncounterIdentifier]=currentCommandArguments;
 if(!((currentActionName==='list'&&currentCommandArguments.length===1)
   ||(currentActionName==='run'&&currentCommandArguments.length===2&&/^[a-z][a-z0-9-]*$/.test(currentEncounterIdentifier))))
   throw new Error('substitute list / substitute run 조우ID로 입력하세요.');
 if(!currentTextClient.state)throw new Error('먼저 로그인하세요.');
 if(currentActionName==='list'){
  const currentHuntCatalog=parseSubstituteHuntCatalog(await currentTextClient.request('/v1/game/substitute-hunts/catalog'));
  return ['보유 FP: '+currentHuntCatalog.fp,...currentHuntCatalog.encounters.map(currentHuntEntry=>
   `${currentHuntEntry.nameTranslations.ko.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ')} [${currentHuntEntry.encounterId}] × ${currentHuntEntry.enemyCount} · ${currentHuntEntry.fpCost} FP · ${currentHuntEntry.available?'실행 가능':SUBSTITUTE_HUNT_REASONS[currentHuntEntry.unavailableReason]}`)].join('\n');
 }
 return currentTextClient.command('/v1/game/substitute-hunts',{encounterId:currentEncounterIdentifier},currentCommandResult=>{
  const currentHuntResult=currentCommandResult.substituteHunt;
  return `대체 사냥 완료 · 소비 FP ${currentHuntResult.fpConsumed} · 잔여 FP ${currentHuntResult.fpRemaining}\n`+
    (currentHuntResult.materials.length?currentHuntResult.materials.map(currentMaterialEntry=>`${currentMaterialEntry.materialId} × ${currentMaterialEntry.quantity}`).join('\n'):'획득한 수집품이 없습니다.');
 },{fetchStateAfterReceipt:true,validateCommandResponse:(currentCommandResult,currentRequestBody)=>
   parseSubstituteHuntReceipt(currentCommandResult,currentRequestBody.requestId,currentRequestBody.encounterId)});
}
