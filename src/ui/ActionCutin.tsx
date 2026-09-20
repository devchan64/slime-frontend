import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../i18n';
import { findActionCutinPresentation, type ActionCutinEvent } from './actionCutins';
import { resolveActionCutinAsset } from './actionCutinAssets';
const ACTION_CUTIN_IMAGE_TIMEOUT = 3000;

export function ActionCutinOverlay({ actionCutinEventRecord, finishActionCutinDisplay }: {
  actionCutinEventRecord: ActionCutinEvent; finishActionCutinDisplay: () => void;
}) {
  const actionCutinActionPresentation = findActionCutinPresentation(actionCutinEventRecord.actionType);
  if (!actionCutinActionPresentation) throw new Error('표시 정의가 없는 액션 컷인 명령입니다.');
  const { t: translateActionCutinText } = useTranslation();
  const [actionCutinImageFailed, setActionCutinImageFailed] = useState(false);
  const [actionCutinImageSettled, setActionCutinImageSettled] = useState(false);
  const actionCutinFinishCallback = useRef(finishActionCutinDisplay);
  actionCutinFinishCallback.current = finishActionCutinDisplay;
  useEffect(() => {
    const actionCutinDisplayTimer = window.setTimeout(() => {
      if (actionCutinImageSettled) actionCutinFinishCallback.current();
      else { setActionCutinImageFailed(true); setActionCutinImageSettled(true); }
    }, actionCutinImageSettled ? actionCutinActionPresentation.displayDurationMilliseconds : ACTION_CUTIN_IMAGE_TIMEOUT);
    return () => window.clearTimeout(actionCutinDisplayTimer);
  }, [actionCutinImageSettled]);
  return <aside class="action-cutin" role="status" aria-label={translateActionCutinText('cutins.presentation')}>
    <img src={resolveActionCutinAsset(actionCutinEventRecord.appearance)} alt="" onLoad={() => setActionCutinImageSettled(true)}
      onError={() => { setActionCutinImageFailed(true); setActionCutinImageSettled(true); }} />
    <div><strong>{actionCutinEventRecord.actorName}</strong>
      <p>{translateActionCutinText(actionCutinActionPresentation.translationMessageKey)}</p>
      {actionCutinImageFailed && <p role="alert">{translateActionCutinText('cutins.imageFailed')}</p>}
    </div>
    <button onClick={finishActionCutinDisplay}>{translateActionCutinText('cutins.skip')}</button>
  </aside>;
}
