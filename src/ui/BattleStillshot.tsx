import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../i18n';
import { STILLSHOT_DISPLAY_MILLISECONDS, type BattleStillshotEvent } from './battleStillshots';
import { resolveStillshotAsset } from './stillshotAssets';
const STILLSHOT_IMAGE_TIMEOUT = 3000;

export function BattleStillshot({ stillshotEventRecord, finishStillshotDisplay }: {
  stillshotEventRecord: BattleStillshotEvent; finishStillshotDisplay: () => void;
}) {
  const { t: translateStillshotText } = useTranslation();
  const [stillshotImageFailed, setStillshotImageFailed] = useState(false);
  const [stillshotImageSettled, setStillshotImageSettled] = useState(false);
  const stillshotFinishCallback = useRef(finishStillshotDisplay);
  stillshotFinishCallback.current = finishStillshotDisplay;
  useEffect(() => {
    const stillshotDisplayTimer = window.setTimeout(() => {
      if (stillshotImageSettled) stillshotFinishCallback.current();
      else { setStillshotImageFailed(true); setStillshotImageSettled(true); }
    }, stillshotImageSettled ? STILLSHOT_DISPLAY_MILLISECONDS : STILLSHOT_IMAGE_TIMEOUT);
    return () => window.clearTimeout(stillshotDisplayTimer);
  }, [stillshotImageSettled]);
  return <aside class="battle-stillshot" role="status" aria-label={translateStillshotText('stillshots.presentation')}>
    <img src={resolveStillshotAsset(stillshotEventRecord.appearance)} alt="" onLoad={() => setStillshotImageSettled(true)}
      onError={() => { setStillshotImageFailed(true); setStillshotImageSettled(true); }} />
    <div><strong>{stillshotEventRecord.actorName}</strong>
      <p>{translateStillshotText(stillshotEventRecord.actionType === 'SKILL' ? 'stillshots.skill' : 'stillshots.attack')}</p>
      {stillshotImageFailed && <p role="alert">{translateStillshotText('stillshots.imageFailed')}</p>}
    </div>
    <button onClick={finishStillshotDisplay}>{translateStillshotText('stillshots.skip')}</button>
  </aside>;
}
