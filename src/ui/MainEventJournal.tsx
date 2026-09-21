import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseMainEventJournal,type MainJournalPage} from '../client/mainEventJournal';
import {noticeText,type Notice} from '../client/notice';
import {getLocale,useTranslation} from '../i18n';

export function MainEventJournal({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}) {
  const {t:translateJournalText,locale:currentJournalLocale}=useTranslation();
  const [currentJournalPage,setCurrentJournalPage]=useState<MainJournalPage|null>(null);
  const [currentJournalNotice,setCurrentJournalNotice]=useState<Notice>('');
  const [journalRequestPending,setJournalRequestPending]=useState(false);
  const activeJournalReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,character:gameSessionClient.state?.me.id});
  function journalSessionMatches() {
    return activeJournalReference.current && gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
      && gameSessionClient.state?.generation===initialSessionReference.current.generation
      && gameSessionClient.state?.me.id===initialSessionReference.current.character;
  }
  async function loadJournalEntries() {
    if(pendingRequestReference.current)return;
    const requestedJournalLocale=getLocale();
    pendingRequestReference.current=true;setJournalRequestPending(true);setCurrentJournalNotice('');
    try {
      const receivedJournalPage=parseMainEventJournal(await gameSessionClient.request(`/v1/game/main-events?includeCapacity=true&language=${requestedJournalLocale}`));
      if(journalSessionMatches()&&requestedJournalLocale===getLocale())setCurrentJournalPage(receivedJournalPage);
    } catch(currentRequestError) {
      if(journalSessionMatches())setCurrentJournalNotice(currentRequestError as Error);
    } finally {
      pendingRequestReference.current=false;
      if(journalSessionMatches()){setJournalRequestPending(false);if(requestedJournalLocale!==getLocale())void loadJournalEntries();}
    }
  }
  useEffect(()=>{activeJournalReference.current=true;void loadJournalEntries();return()=>{activeJournalReference.current=false;};},[currentJournalLocale]);
  return <section aria-label={translateJournalText('journal.title')}>
    <p>{translateJournalText('journal.help')}</p>
    {currentJournalPage?.acceptedCount!==undefined && <div>
      <p role="status">{translateJournalText('journal.capacity',{count:currentJournalPage.acceptedCount,limit:currentJournalPage.maximumAcceptedCount!})}</p>
      <p>{translateJournalText('journal.capacityHelp')}</p>
      {currentJournalPage.acceptedCount>=currentJournalPage.maximumAcceptedCount! && <p>{translateJournalText('journal.capacityFull')}</p>}
    </div>}
    <button class="secondary" disabled={actionsAreDisabled||journalRequestPending} onClick={()=>void loadJournalEntries()}>{translateJournalText('journal.refresh')}</button>
    {currentJournalNotice && <p role="alert">{noticeText(currentJournalNotice,currentJournalLocale,translateJournalText)}</p>}
    {journalRequestPending && <p role="status">{translateJournalText('journal.loading')}</p>}
    {currentJournalPage && !currentJournalPage.entries.length && <p>{translateJournalText('journal.empty')}</p>}
    <ul class="bag-items">{currentJournalPage?.entries.map(currentJournalEntry=><li key={currentJournalEntry.eventId}>
      <strong>{currentJournalEntry.title}</strong>
      <p>{translateJournalText(currentJournalEntry.status==='COMPLETED'?'journal.completed':'journal.accepted')}</p>
      <p>{translateJournalText('journal.receiver',{name:currentJournalEntry.receiver.name})}</p>
      {currentJournalEntry.items.map(currentMaterialItem=><p key={currentMaterialItem.itemId}>
        {translateJournalText('journal.material',{name:currentMaterialItem.nameTranslations[currentJournalLocale],owned:currentMaterialItem.owned,required:currentMaterialItem.required})}
      </p>)}
      <p>{translateJournalText(currentJournalEntry.status==='COMPLETED'?'journal.paid':'journal.reward',{amount:currentJournalEntry.moneyP})}</p>
      <small>{translateJournalText(currentJournalEntry.status==='COMPLETED'?'journal.finishedAt':'journal.startedAt',
        {time:new Date((currentJournalEntry.completedAt??currentJournalEntry.acceptedAt)*1000).toLocaleString(currentJournalLocale)})}</small>
      {currentJournalEntry.materialsSufficient && <p>{translateJournalText('journal.materialsReady')}</p>}
    </li>)}</ul>
  </section>;
}
