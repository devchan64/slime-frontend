import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../i18n';
import { findActionCutinPresentation, type ActionCutinEvent } from './actionCutins';
import { resolveActionCutinAsset, resolveActionCutinFrame } from './actionCutinAssets';
const ACTION_CUTIN_SECOND_MILLISECONDS = 1000;
const ACTION_CUTIN_COLLISION_MILLISECONDS = 260;

function CutinActor({ appearance, side, imageFailed }: { appearance: ActionCutinEvent['appearance']; side: 'attacker' | 'target'; imageFailed: () => void }) {
  const currentCutinFrame = resolveActionCutinFrame(appearance);
  const currentCutinUrl = resolveActionCutinAsset(appearance);
  return <div class={`action-cutin-duel-actor action-cutin-duel-${side}`}>
    {currentCutinFrame ? <svg aria-hidden="true" viewBox={`${currentCutinFrame.rect.x} ${currentCutinFrame.rect.y} ${currentCutinFrame.rect.width} ${currentCutinFrame.rect.height}`}>
      <image href={currentCutinUrl} width={currentCutinFrame.sheet.width} height={currentCutinFrame.sheet.height} onError={imageFailed} />
    </svg> : <img src={currentCutinUrl} alt="" onError={imageFailed} />}
  </div>;
}

export function ActionCutinOverlay({ actionCutinEventRecord, actionCutinDurationSeconds, finishActionCutinDisplay }: {
  actionCutinEventRecord: ActionCutinEvent; actionCutinDurationSeconds: 1 | 2 | 3; finishActionCutinDisplay: () => void;
}) {
  const actionCutinActionPresentation = findActionCutinPresentation(actionCutinEventRecord.actionType);
  if (!actionCutinActionPresentation) throw new Error('표시 정의가 없는 액션 컷인 명령입니다.');
  const { t: translateActionCutinText } = useTranslation();
  const [actionCutinImageFailed, setActionCutinImageFailed] = useState(false);
  const [actionCutinCollisionActive, setActionCutinCollisionActive] = useState(false);
  const actionCutinFinishCallback = useRef(finishActionCutinDisplay);
  actionCutinFinishCallback.current = finishActionCutinDisplay;
  useEffect(() => {
    const actionCutinDisplayTimer = window.setTimeout(() => actionCutinFinishCallback.current(),
      actionCutinDurationSeconds * ACTION_CUTIN_SECOND_MILLISECONDS);
    return () => window.clearTimeout(actionCutinDisplayTimer);
  }, [actionCutinDurationSeconds]);
  useEffect(() => {
    const activationFrame = window.requestAnimationFrame(() => setActionCutinCollisionActive(true));
    const returnTimer = window.setTimeout(() => setActionCutinCollisionActive(false), ACTION_CUTIN_COLLISION_MILLISECONDS);
    return () => { window.cancelAnimationFrame(activationFrame); window.clearTimeout(returnTimer); };
  }, [actionCutinEventRecord.actionId]);
  const hasTarget = actionCutinEventRecord.targetAppearance && actionCutinEventRecord.targetName;
  return <aside class={`action-cutin${hasTarget ? ' action-cutin-duel' : ''}${actionCutinCollisionActive ? ' action-cutin-collision-active' : ''}`} role="status" aria-label={translateActionCutinText('cutins.presentation')}>
    {hasTarget ? <>
      <CutinActor appearance={actionCutinEventRecord.appearance} side="attacker" imageFailed={() => setActionCutinImageFailed(true)} />
      <CutinActor appearance={actionCutinEventRecord.targetAppearance!} side="target" imageFailed={() => setActionCutinImageFailed(true)} />
    </> : <CutinActor appearance={actionCutinEventRecord.appearance} side="attacker" imageFailed={() => setActionCutinImageFailed(true)} />}
    <div class="action-cutin-caption"><strong>{actionCutinEventRecord.actorName}</strong>
      {hasTarget && <span class="action-cutin-target-name"> × {actionCutinEventRecord.targetName}</span>}
      <p>{translateActionCutinText(actionCutinActionPresentation.translationMessageKey)}</p>
      {actionCutinImageFailed && <p role="alert">{translateActionCutinText('cutins.imageFailed')}</p>}
    </div>
  </aside>;
}
