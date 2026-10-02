import {isHealthFull} from '../client/health-state.mjs';
import type { State } from '../client/types';
import { useTranslation } from '../i18n';

export function FieldFirstAid({ currentGameState, actionsAreDisabled, submitFirstAidCommand }: {
  currentGameState: State; actionsAreDisabled: boolean; submitFirstAidCommand: (currentBatchIdentifier?:string) => unknown;
}) {
  const { t: translateFirstAid } = useTranslation();
  const currentPlayerState = currentGameState.me;
  const currentFirstAidPolicy = currentPlayerState.firstAid;
  if (!currentFirstAidPolicy) return null;
  const currentBandageCount = currentPlayerState.bag?.items.find(currentItemEntry => currentItemEntry.kind === 'consumable'
    && currentItemEntry.id === currentFirstAidPolicy.consumableId)?.quantity ?? 0;
  const currentSafeDistance = Math.abs(currentPlayerState.position.column-currentGameState.map.startPoint.column)
    + Math.abs(currentPlayerState.position.row-currentGameState.map.startPoint.row);
  const currentCommonDisabled = actionsAreDisabled || currentPlayerState.mode !== 'FIELD' || !!currentPlayerState.battleId
    || currentSafeDistance <= currentGameState.map.safeRadius || (currentPlayerState.fp ?? 0) < 0
    || currentPlayerState.hp === undefined || currentPlayerState.maxHp === undefined
    || isHealthFull(currentPlayerState)
    || (currentPlayerState.skills.first_aid ?? 0) < currentFirstAidPolicy.minimumUseLevel
    || (currentPlayerState.skills.literacy ?? 0) < currentFirstAidPolicy.literacyRequired
    || !!currentPlayerState.skillUseLocks?.first_aid;
  const currentLegacyButton = <button class="secondary compact" disabled={currentCommonDisabled || currentBandageCount < currentFirstAidPolicy.consumedOnSuccess} onClick={()=>submitFirstAidCommand()}
    title={translateFirstAid('field.firstAidHint',{amount:currentFirstAidPolicy.restorationHp, count:currentFirstAidPolicy.consumedOnSuccess, literacy:currentFirstAidPolicy.literacyRequired})}>
    {translateFirstAid('field.firstAidButton',{count:currentBandageCount})}
  </button>;
  const currentBatchEntries=currentPlayerState.bag?.items.filter(currentItemEntry=>currentItemEntry.kind==='consumable'
    &&currentItemEntry.definitionId===currentFirstAidPolicy.consumableId&&currentItemEntry.batchId!==undefined)??[];
  if(!currentBatchEntries.length)return currentLegacyButton;
  return <>{currentLegacyButton}{currentBatchEntries.map((currentBatchEntry,currentBatchIndex)=><button key={currentBatchEntry.id} class="secondary compact"
    disabled={currentCommonDisabled||currentBatchEntry.quantity<currentFirstAidPolicy.consumedOnSuccess}
    onClick={()=>submitFirstAidCommand(currentBatchEntry.batchId)}>
    {translateFirstAid('field.firstAidButton',{count:currentBatchEntry.quantity})} · Lv.{currentBatchEntry.itemLevel} · #{currentBatchIndex+1}
  </button>)}</>;
}
