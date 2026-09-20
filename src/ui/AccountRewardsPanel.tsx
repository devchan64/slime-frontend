import { useEffect, useRef, useState } from 'preact/hooks';
import type { Client } from '../client/api';
import { noticeText, type Notice } from '../client/notice';
import { parseAccountRewardPage, rewardRemainingSeconds, REWARD_CLOCK_INTERVAL_MS, type AccountRewardPage } from '../client/accountRewards';
import { useTranslation } from '../i18n';

export function AccountRewardsPanel({gameSessionClient, actionsAreDisabled}: {gameSessionClient: Client; actionsAreDisabled: boolean}) {
  const {t: translateRewardText, locale: currentLocaleCode} = useTranslation();
  const [storedRewardPage, setStoredRewardPage] = useState<AccountRewardPage | null>(null);
  const [currentRewardNotice, setCurrentRewardNotice] = useState<Notice>('');
  const [isRewardLoading, setIsRewardLoading] = useState(false);
  const [claimedRewardIdentifier, setClaimedRewardIdentifier] = useState<string | null>(null);
  const [rewardClockValue, setRewardClockValue] = useState(performance.now());
  const rewardClockAnchor = useRef(performance.now());
  const activePanelReference = useRef(false);
  const pendingRewardRequest = useRef(false);
  const initialSessionReference = useRef({owner: gameSessionClient.tokens?.user_id, generation: gameSessionClient.state?.generation});
  function panelSessionMatches() {
    return activePanelReference.current && gameSessionClient.tokens?.user_id === initialSessionReference.current.owner
      && gameSessionClient.state?.generation === initialSessionReference.current.generation;
  }
  async function loadRewardPage(afterRewardIdentifier?: string) {
    if (pendingRewardRequest.current) return;
    pendingRewardRequest.current = true; setIsRewardLoading(true); setCurrentRewardNotice('');
    try {
      const receivedRewardPage = parseAccountRewardPage(await gameSessionClient.request('/v1/accounts/me/rewards' + (afterRewardIdentifier ? `?after=${encodeURIComponent(afterRewardIdentifier)}` : '')));
      if (!panelSessionMatches()) return;
      rewardClockAnchor.current = performance.now(); setRewardClockValue(rewardClockAnchor.current);
      setStoredRewardPage(previousRewardPage => ({...receivedRewardPage, entries: afterRewardIdentifier
        ? [...(previousRewardPage?.entries ?? []), ...receivedRewardPage.entries] : receivedRewardPage.entries}));
    } catch (rewardRequestError) { if (panelSessionMatches()) setCurrentRewardNotice(rewardRequestError as Error); }
    finally { pendingRewardRequest.current = false; if (panelSessionMatches()) setIsRewardLoading(false); }
  }
  useEffect(() => {
    activePanelReference.current = true; void loadRewardPage();
    const rewardClockTimer = setInterval(() => setRewardClockValue(performance.now()), REWARD_CLOCK_INTERVAL_MS);
    return () => {activePanelReference.current = false; clearInterval(rewardClockTimer);};
  }, []);
  async function claimStoredReward(accountRewardIdentifier: string) {
    if (pendingRewardRequest.current || actionsAreDisabled) return;
    pendingRewardRequest.current = true; setClaimedRewardIdentifier(accountRewardIdentifier); setCurrentRewardNotice('');
    try {
      await gameSessionClient.request(`/v1/accounts/me/rewards/${encodeURIComponent(accountRewardIdentifier)}/claim`, {});
      if (!panelSessionMatches()) return;
      setStoredRewardPage(previousRewardPage => previousRewardPage && ({...previousRewardPage, entries: previousRewardPage.entries.filter(storedRewardEntry => storedRewardEntry.id !== accountRewardIdentifier)}));
      setCurrentRewardNotice({key:'rewards.claimed'});
      const currentCharacterState = await gameSessionClient.request('/v1/game/state');
      if (panelSessionMatches()) gameSessionClient.accept(currentCharacterState);
    } catch (rewardRequestError) { if (panelSessionMatches()) setCurrentRewardNotice(rewardRequestError as Error); }
    finally {pendingRewardRequest.current = false; if (panelSessionMatches()) setClaimedRewardIdentifier(null);}
  }
  const rewardActionPending = isRewardLoading || claimedRewardIdentifier !== null;
  return <section aria-label={translateRewardText('rewards.title')}>
    <p>{translateRewardText('rewards.help')}</p>
    <button class="secondary" disabled={actionsAreDisabled || rewardActionPending} onClick={() => void loadRewardPage()}>{translateRewardText('rewards.refresh')}</button>
    {currentRewardNotice && <p role={currentRewardNotice instanceof Error ? 'alert' : 'status'}>{noticeText(currentRewardNotice, currentLocaleCode, translateRewardText)}</p>}
    {isRewardLoading && <p role="status">{translateRewardText('rewards.loading')}</p>}
    {storedRewardPage && !storedRewardPage.entries.length && <p>{translateRewardText('rewards.empty')}</p>}
    <ul class="bag-items">{storedRewardPage?.entries.map(storedRewardEntry => {
      const remainingRewardSeconds = rewardRemainingSeconds(storedRewardEntry.expiresAt, storedRewardPage.serverTime, rewardClockValue - rewardClockAnchor.current);
      return <li key={storedRewardEntry.id}>
        {storedRewardEntry.materials.map(storedMaterialEntry => <div key={storedMaterialEntry.materialId}><strong>{storedMaterialEntry.nameTranslations[currentLocaleCode]}</strong><span>×{storedMaterialEntry.quantity.toLocaleString(currentLocaleCode)}</span></div>)}
        <p>{remainingRewardSeconds > 0 ? translateRewardText('rewards.remaining', {hours:Math.floor(remainingRewardSeconds / 3600), minutes:Math.floor(remainingRewardSeconds % 3600 / 60)}) : translateRewardText('rewards.expired')}</p>
        <p>{translateRewardText('rewards.expires', {time:new Date(storedRewardEntry.expiresAt * 1000).toLocaleString(currentLocaleCode)})}</p>
        <button disabled={actionsAreDisabled || rewardActionPending || remainingRewardSeconds <= 0} onClick={() => void claimStoredReward(storedRewardEntry.id)}>{translateRewardText(claimedRewardIdentifier === storedRewardEntry.id ? 'rewards.claiming' : 'rewards.claim')}</button>
      </li>;
    })}</ul>
    {storedRewardPage?.nextCursor && <button class="secondary" disabled={actionsAreDisabled || rewardActionPending} onClick={() => void loadRewardPage(storedRewardPage.nextCursor!)}>{translateRewardText('rewards.more')}</button>}
  </section>;
}
