import {useEffect, useState} from 'preact/hooks';
import {useTranslation} from '../i18n';
import {watchParcelArrivalNotice} from '../client/parcel-notice.mjs';
import type {Client} from '../client/api';

export function ParcelArrivalNotice({currentGameClient, currentCharacterIdentifier}: {
  currentGameClient: Client; currentCharacterIdentifier: string;
}) {
  const {t: translateNoticeText} = useTranslation();
  const [currentPendingCount, setCurrentPendingCount] = useState<number | null>(null);
  const [currentNoticeFailed, setCurrentNoticeFailed] = useState(false);
  useEffect(() => watchParcelArrivalNotice(
    () => currentGameClient.request('/v1/game/parcels/notice'), currentCharacterIdentifier,
    currentNoticeCount => {setCurrentPendingCount(currentNoticeCount); setCurrentNoticeFailed(false);},
    () => {setCurrentPendingCount(null); setCurrentNoticeFailed(true);}
  ), [currentGameClient, currentCharacterIdentifier]);
  return <aside class="parcel-arrival-notice" role="status" aria-live="polite">
    {currentNoticeFailed ? translateNoticeText('parcels.noticeFailed') : currentPendingCount
      ? translateNoticeText('parcels.arrived', {count: currentPendingCount}) : null}
  </aside>;
}
