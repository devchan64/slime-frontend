import type { State } from '../client/types';
import { useTranslation } from '../i18n';

export function FieldFirstAid({ currentGameState, actionsAreDisabled, submitFirstAidCommand }: {
  currentGameState: State; actionsAreDisabled: boolean; submitFirstAidCommand: () => unknown;
}) {
  const { t: translateFirstAid } = useTranslation();
  const currentPlayerState = currentGameState.me;
  const currentFirstAidPolicy = currentPlayerState.firstAid;
  if (!currentFirstAidPolicy) return null;
  const currentBandageCount = currentPlayerState.bag?.items.find(currentItemEntry => currentItemEntry.kind === 'consumable'
    && currentItemEntry.id === currentFirstAidPolicy.consumableId)?.quantity ?? 0;
  const currentSafeDistance = Math.abs(currentPlayerState.position.column-currentGameState.map.startPoint.column)
    + Math.abs(currentPlayerState.position.row-currentGameState.map.startPoint.row);
  const currentActionDisabled = actionsAreDisabled || currentPlayerState.mode !== 'FIELD' || !!currentPlayerState.battleId
    || currentSafeDistance <= currentGameState.map.safeRadius || (currentPlayerState.fp ?? 0) < 0
    || currentPlayerState.hp === undefined || currentPlayerState.maxHp === undefined
    || currentPlayerState.hp >= currentPlayerState.maxHp || currentBandageCount < currentFirstAidPolicy.consumedOnSuccess
    || (currentPlayerState.skills.first_aid ?? 0) < currentFirstAidPolicy.minimumUseLevel
    || (currentPlayerState.skills.literacy ?? 0) < currentFirstAidPolicy.literacyRequired
    || !!currentPlayerState.skillUseLocks?.first_aid;
  return <button class="secondary compact" disabled={currentActionDisabled} onClick={submitFirstAidCommand}
    title={translateFirstAid('field.firstAidHint',{amount:currentFirstAidPolicy.restorationHp, count:currentFirstAidPolicy.consumedOnSuccess, literacy:currentFirstAidPolicy.literacyRequired})}>
    {translateFirstAid('field.firstAidButton',{count:currentBandageCount})}
  </button>;
}
