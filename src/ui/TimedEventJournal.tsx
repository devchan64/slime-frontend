import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseTimedEventPage,type TimedEventPage} from '../client/timed-event-validation.mjs';
import {noticeText} from '../client/notice';
import {getLocale,useTranslation} from '../i18n';

export function TimedEventJournal({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}){
 const {t:translateTimedText,locale:currentDisplayLocale}=useTranslation();
 const [currentPanelOpen,setCurrentPanelOpen]=useState(false);
 const [currentJournalPage,setCurrentJournalPage]=useState<TimedEventPage|null>(null);
 const [currentRequestBusy,setCurrentRequestBusy]=useState(false);
 const [currentRequestError,setCurrentRequestError]=useState<Error|null>(null);
 const currentRequestActive=useRef(false);
 const currentComponentAlive=useRef(false);
 const currentOriginalSession=useRef([gameSessionClient.tokens?.user_id,gameSessionClient.state?.me.id,gameSessionClient.state?.generation]);
 function matchesTimedJournalSession(){return currentComponentAlive.current&&JSON.stringify(currentOriginalSession.current)===JSON.stringify([gameSessionClient.tokens?.user_id,gameSessionClient.state?.me.id,gameSessionClient.state?.generation]);}
 async function loadTimedJournalPage(currentPageOffset=0){
  if(currentRequestActive.current||!matchesTimedJournalSession())return;
  const currentRequestedLocale=getLocale();currentRequestActive.current=true;setCurrentRequestBusy(true);setCurrentRequestError(null);
  try{
   const currentReceivedPage=parseTimedEventPage(await gameSessionClient.request(`/v1/game/timed-events?language=${currentRequestedLocale}&offset=${currentPageOffset}`));
   if(currentReceivedPage.npc!==null)throw new Error('개인 기간 의뢰 기록이 아닙니다.');
   if(matchesTimedJournalSession()&&currentRequestedLocale===getLocale())setCurrentJournalPage(currentReceivedPage);
  }catch(currentFailure){if(matchesTimedJournalSession())setCurrentRequestError(currentFailure as Error);}
  finally{currentRequestActive.current=false;if(matchesTimedJournalSession()){setCurrentRequestBusy(false);if(currentRequestedLocale!==getLocale())void loadTimedJournalPage();}}
 }
 useEffect(()=>{currentComponentAlive.current=true;return()=>{currentComponentAlive.current=false;};},[]);
 useEffect(()=>{if(currentPanelOpen)void loadTimedJournalPage();},[currentPanelOpen,currentDisplayLocale]);
 return <section aria-label={translateTimedText('timedquests.title')}>
  <button class="secondary" disabled={actionsAreDisabled||currentRequestBusy} aria-expanded={currentPanelOpen} onClick={()=>setCurrentPanelOpen(!currentPanelOpen)}>{translateTimedText('timedquests.title')}</button>
  {currentPanelOpen&&<div>
   <button disabled={actionsAreDisabled||currentRequestBusy} onClick={()=>void loadTimedJournalPage()}>{translateTimedText('journal.refresh')}</button>
   {currentRequestError&&<p role="alert">{noticeText(currentRequestError,currentDisplayLocale,translateTimedText)}</p>}
   {currentRequestBusy&&<p role="status">{translateTimedText('journal.loading')}</p>}
   {currentJournalPage&&!currentJournalPage.entries.length&&<p>{translateTimedText('timedquests.empty')}</p>}
   <ul>{currentJournalPage?.entries.map(currentQuestEntry=><li key={currentQuestEntry.offerId}>
    <strong>{currentQuestEntry.title}</strong><p>{translateTimedText(currentQuestEntry.status==='EXPIRED'?'timedquests.expired':currentQuestEntry.status==='COMPLETED'?'journal.completed':'journal.accepted')}</p>
    <p>{translateTimedText('timedquests.destination',{name:currentQuestEntry.destination.name})}</p>
    <p>{translateTimedText('timedquests.deliverBefore',{time:new Date(currentQuestEntry.deliveryDeadline*1000).toLocaleString(currentDisplayLocale)})}</p>
    {currentQuestEntry.items.map(currentItemEntry=><p key={currentItemEntry.itemId}>{translateTimedText('journal.material',{name:currentItemEntry.nameTranslations[currentDisplayLocale],owned:currentItemEntry.owned,required:currentItemEntry.required})}</p>)}
    <p>{translateTimedText(currentQuestEntry.status==='COMPLETED'?'journal.paid':'journal.reward',{amount:currentQuestEntry.moneyP})}</p>
   </li>)}</ul>
   {currentJournalPage?.nextOffset!==null&&currentJournalPage&&<button disabled={actionsAreDisabled||currentRequestBusy} onClick={()=>void loadTimedJournalPage(currentJournalPage.nextOffset!)}>{translateTimedText('timedquests.next')}</button>}
  </div>}
 </section>;
}
