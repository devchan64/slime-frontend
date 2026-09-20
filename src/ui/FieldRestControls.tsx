import type { State } from '../client/types';
import { useTranslation } from '../i18n';

type FieldRestControlProps = {
  currentPlayerState: State['me']; currentServerTime: number; actionsAreDisabled: boolean;
  submitRestCommand: (commandPathValue: string) => unknown;
};

export function FieldRestControls({ currentPlayerState, currentServerTime, actionsAreDisabled, submitRestCommand }: FieldRestControlProps) {
  const { t: translateRestMessage } = useTranslation();
  const currentRestState = currentPlayerState.fieldRest;
  if (!currentRestState) return null;
  const isCurrentlyResting = currentRestState.active;
  const restActionDisabled = actionsAreDisabled || currentPlayerState.mode !== 'FIELD'
    || (!isCurrentlyResting && currentPlayerState.fp !== undefined && currentPlayerState.fp < 0);
  const remainingRestSeconds = currentRestState.nextRecoveryAt === null ? 0
    : Math.max(0, Math.ceil(currentRestState.nextRecoveryAt - currentServerTime));
  return <div class="field-rest-controls">
    <button class={isCurrentlyResting ? "secondary compact is-resting" : "secondary compact"} aria-pressed={isCurrentlyResting} disabled={restActionDisabled}
      onClick={() => submitRestCommand(`/v1/game/rest/${isCurrentlyResting ? 'stop' : 'start'}`)}>
      {translateRestMessage(isCurrentlyResting ? 'field.restStop' : 'field.restStart')}
    </button>
    {isCurrentlyResting && <small role="status" title={translateRestMessage('field.restProgress', { amount: currentRestState.recoveryPerMinute, seconds: remainingRestSeconds })}>{translateRestMessage('field.restCompactProgress', {
      amount: currentRestState.recoveryPerMinute, seconds: remainingRestSeconds,
    })}</small>}
  </div>;
}
