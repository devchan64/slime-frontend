import { PartyFormationPanel } from './PartyFormationPanel';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Client } from '../client/api';
import { noticeText, type Notice } from '../client/notice';
import { parseBorrowedLoanPage, calculateLoanRemainingSeconds, LOAN_CLOCK_INTERVAL_MS, type BorrowedLoanPage } from '../client/borrowedLoans';
import { useTranslation } from '../i18n';

const LOAN_CP_STATUS_LABELS={ELIGIBLE:'loans.cpEligible',OUT_OF_RANGE:'loans.cpOutOfRange',MIGRATION_REQUIRED:'loans.cpMigrationRequired'};

export function BorrowedLoansPanel({gameSessionClient, actionsAreDisabled}: {gameSessionClient: Client; actionsAreDisabled: boolean}) {
  const {t: translateLoanText, locale: currentLocaleCode} = useTranslation();
  const [storedLoanPage, setStoredLoanPage] = useState<BorrowedLoanPage | null>(null);
  const [currentLoanNotice, setCurrentLoanNotice] = useState<Notice>('');
  const [isLoanLoading, setIsLoanLoading] = useState(false);
  const [loanClockValue, setLoanClockValue] = useState(performance.now());
  const loanClockAnchor = useRef(performance.now());
  const activePanelReference = useRef(false);
  const pendingLoanRequest = useRef(false);
  const initialSessionReference = useRef({owner: gameSessionClient.tokens?.user_id, generation: gameSessionClient.state?.generation});
  function panelSessionMatches() {
    return activePanelReference.current && gameSessionClient.tokens?.user_id === initialSessionReference.current.owner
      && gameSessionClient.state?.generation === initialSessionReference.current.generation;
  }
  async function loadLoanPage(afterLoanIdentifier?: string) {
    if (pendingLoanRequest.current) return;
    pendingLoanRequest.current = true; setIsLoanLoading(true); setCurrentLoanNotice('');
    try {
      const receivedLoanPage = parseBorrowedLoanPage(await gameSessionClient.request('/v1/game/loans' + (afterLoanIdentifier ? `?after=${encodeURIComponent(afterLoanIdentifier)}` : '')));
      if (!panelSessionMatches()) return;
      loanClockAnchor.current = performance.now(); setLoanClockValue(loanClockAnchor.current);
      setStoredLoanPage(previousLoanPage => ({...receivedLoanPage, entries: afterLoanIdentifier
        ? [...(previousLoanPage?.entries ?? []), ...receivedLoanPage.entries] : receivedLoanPage.entries}));
    } catch (loanRequestError) { if (panelSessionMatches()) setCurrentLoanNotice(loanRequestError as Error); }
    finally { pendingLoanRequest.current = false; if (panelSessionMatches()) setIsLoanLoading(false); }
  }
  useEffect(() => {
    activePanelReference.current = true; void loadLoanPage();
    const loanClockTimer = setInterval(() => setLoanClockValue(performance.now()), LOAN_CLOCK_INTERVAL_MS);
    return () => {activePanelReference.current = false; clearInterval(loanClockTimer);};
  }, []);
  return <section aria-label={translateLoanText('loans.title')}>
    {gameSessionClient.state?.me.mode==='FIELD'&&<PartyFormationPanel
      key={`${gameSessionClient.state.generation}:${gameSessionClient.state.map.id}:${JSON.stringify(gameSessionClient.state.me.position)}`}
      gameSessionClient={gameSessionClient} actionsAreDisabled={actionsAreDisabled} />}
    <p>{translateLoanText('loans.help')}</p>
    <p>{translateLoanText('loans.cpHelp')}</p>
    <button class="secondary" disabled={actionsAreDisabled || isLoanLoading} onClick={() => void loadLoanPage()}>{translateLoanText('loans.refresh')}</button>
    {currentLoanNotice && <p role={currentLoanNotice instanceof Error ? 'alert' : 'status'}>{noticeText(currentLoanNotice, currentLocaleCode, translateLoanText)}</p>}
    {isLoanLoading && <p role="status">{translateLoanText('loans.loading')}</p>}
    {storedLoanPage && !storedLoanPage.entries.length && <p>{translateLoanText('loans.empty')}</p>}
    <ul class="bag-items">{storedLoanPage?.entries.map(storedLoanEntry => {
      const remainingLoanSeconds = calculateLoanRemainingSeconds(storedLoanEntry.expiresAt, storedLoanPage.serverTime, loanClockValue - loanClockAnchor.current);
      return <li key={storedLoanEntry.id}>
        <strong>{storedLoanEntry.name}</strong>
        <p>{translateLoanText(storedLoanEntry.partyCpStatus?LOAN_CP_STATUS_LABELS[storedLoanEntry.partyCpStatus]:'loans.cpUnknown')}</p>
        <p>{translateLoanText('loans.health', {current: storedLoanEntry.hp, maximum: storedLoanEntry.maxHp})}</p>
        {storedLoanEntry.healthRecoveryPending && <p class="is-warning">{translateLoanText('loans.recoveryPending')}</p>}
        <p>{translateLoanText(storedLoanEntry.inBattle ? 'loans.inbattle' : remainingLoanSeconds > 0 ? 'loans.available' : 'loans.ended')}</p>
        <p>{remainingLoanSeconds > 0 ? translateLoanText('loans.remaining', {hours: Math.floor(remainingLoanSeconds / 3600), minutes: Math.floor(remainingLoanSeconds % 3600 / 60)}) : translateLoanText(storedLoanEntry.inBattle ? 'loans.expiredbattle' : 'loans.expired')}</p>
        <p>{translateLoanText('loans.expires', {time: new Date(storedLoanEntry.expiresAt * 1000).toLocaleString(currentLocaleCode)})}</p>
      </li>;
    })}</ul>
    {storedLoanPage?.nextCursor && <button class="secondary" disabled={actionsAreDisabled || isLoanLoading} onClick={() => void loadLoanPage(storedLoanPage.nextCursor!)}>{translateLoanText('loans.more')}</button>}
  </section>;
}
