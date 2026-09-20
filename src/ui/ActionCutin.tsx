import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../i18n';
import { findActionCutinPresentation, type ActionCutinEvent } from './actionCutins';
import { resolveActionCutinAsset } from './actionCutinAssets';
const ACTION_CUTIN_SECOND_MILLISECONDS = 1000;

export function ActionCutinOverlay({ actionCutinEventRecord, actionCutinDurationSeconds, finishActionCutinDisplay }: {
  actionCutinEventRecord: ActionCutinEvent; actionCutinDurationSeconds: 1 | 2 | 3; finishActionCutinDisplay: () => void;
}) {
  const actionCutinActionPresentation = findActionCutinPresentation(actionCutinEventRecord.actionType);
  if (!actionCutinActionPresentation) throw new Error('표시 정의가 없는 액션 컷인 명령입니다.');
  const { t: translateActionCutinText } = useTranslation();
  const [actionCutinImageFailed, setActionCutinImageFailed] = useState(false);
  const actionCutinFinishCallback = useRef(finishActionCutinDisplay);
  actionCutinFinishCallback.current = finishActionCutinDisplay;
  useEffect(() => {
    const actionCutinDisplayTimer = window.setTimeout(() => actionCutinFinishCallback.current(),
      actionCutinDurationSeconds * ACTION_CUTIN_SECOND_MILLISECONDS);
    return () => window.clearTimeout(actionCutinDisplayTimer);
  }, [actionCutinDurationSeconds]);
  return <aside class="action-cutin" role="status" aria-label={translateActionCutinText('cutins.presentation')}>
    <img src={resolveActionCutinAsset(actionCutinEventRecord.appearance)} alt=""
      onError={() => setActionCutinImageFailed(true)} />
    <div><strong>{actionCutinEventRecord.actorName}</strong>
      <p>{translateActionCutinText(actionCutinActionPresentation.translationMessageKey)}</p>
      {actionCutinImageFailed && <p role="alert">{translateActionCutinText('cutins.imageFailed')}</p>}
    </div>
  </aside>;
}
