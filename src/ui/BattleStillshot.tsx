import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../i18n';
import { findStillshotPresentation, type BattleStillshotEvent } from './battleStillshots';
import { resolveStillshotAsset } from './stillshotAssets';
const STILLSHOT_IMAGE_TIMEOUT = 3000;

export function BattleStillshot({ stillshotEventRecord, finishStillshotDisplay }: {
  stillshotEventRecord: BattleStillshotEvent; finishStillshotDisplay: () => void;
}) {
  const stillshotActionPresentation = findStillshotPresentation(stillshotEventRecord.actionType);
  if (!stillshotActionPresentation) throw new Error('표시 정의가 없는 스틸샷 명령입니다.');
  const { t: translateStillshotText } = useTranslation();
  const [stillshotImageFailed, setStillshotImageFailed] = useState(false);
  const [stillshotImageSettled, setStillshotImageSettled] = useState(false);
  const stillshotFinishCallback = useRef(finishStillshotDisplay);
  stillshotFinishCallback.current = finishStillshotDisplay;
  useEffect(() => {
    const stillshotDisplayTimer = window.setTimeout(() => {
      if (stillshotImageSettled) stillshotFinishCallback.current();
      else { setStillshotImageFailed(true); setStillshotImageSettled(true); }
    }, stillshotImageSettled ? stillshotActionPresentation.displayDurationMilliseconds : STILLSHOT_IMAGE_TIMEOUT);
    return () => window.clearTimeout(stillshotDisplayTimer);
  }, [stillshotImageSettled]);
  return <aside class="battle-stillshot" role="status" aria-label={translateStillshotText('stillshots.presentation')}>
    <img src={resolveStillshotAsset(stillshotEventRecord.appearance)} alt="" onLoad={() => setStillshotImageSettled(true)}
      onError={() => { setStillshotImageFailed(true); setStillshotImageSettled(true); }} />
    <div><strong>{stillshotEventRecord.actorName}</strong>
      <p>{translateStillshotText(stillshotActionPresentation.translationMessageKey)}</p>
      {stillshotImageFailed && <p role="alert">{translateStillshotText('stillshots.imageFailed')}</p>}
    </div>
    <button onClick={finishStillshotDisplay}>{translateStillshotText('stillshots.skip')}</button>
  </aside>;
}
