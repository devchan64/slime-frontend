import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseHuntLedgerPage,localizedHuntName,type HuntLedgerPage} from '../client/huntLedger';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

const HUNT_LEDGER_PAGE_SIZE=10;
const HUNT_RESULT_LABEL_KEYS:Record<string,string>={WIN:'battle.resultWin',LOSE:'battle.resultLose',TIMEOUT:'battle.resultTimeout',SURRENDER:'battle.resultSurrender'};

export function HuntLedgerPanel({gameSessionClient,isLedgerPanelActive=true}:{gameSessionClient:Client;isLedgerPanelActive?:boolean}){
  const {t:translateLedgerText,locale:currentLocaleCode}=useTranslation();
  const [currentLedgerPage,setCurrentLedgerPage]=useState<HuntLedgerPage|null>(null);
  const [ledgerPageCursorHistory,setLedgerPageCursorHistory]=useState<number[]>([0]);
  const [currentLedgerNotice,setCurrentLedgerNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const activeRequestSequence=useRef(0);
  const pendingRequestReference=useRef(false);
  async function loadHuntLedger(requestedLedgerCursors:number[]=[0]){
    const requestedLedgerCursor=requestedLedgerCursors[requestedLedgerCursors.length-1];
    if(pendingRequestReference.current)return;
    pendingRequestReference.current=true;
    const currentRequestSequence=++activeRequestSequence.current;
    const currentSessionIdentity={owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,character:gameSessionClient.state?.me.id};
    const matchesCurrentSession=()=>activeRequestSequence.current===currentRequestSequence
      &&currentSessionIdentity.owner===gameSessionClient.tokens?.user_id
      &&currentSessionIdentity.generation===gameSessionClient.state?.generation
      &&currentSessionIdentity.character===gameSessionClient.state?.me.id;
    setCurrentRequestPending(true);setCurrentLedgerNotice('');
    try{
      const receivedLedgerPage=parseHuntLedgerPage(await gameSessionClient.request('/v1/characters/me/hunts?after='+requestedLedgerCursor+'&limit='+HUNT_LEDGER_PAGE_SIZE),requestedLedgerCursor);
      if(matchesCurrentSession()){setCurrentLedgerPage(receivedLedgerPage);setLedgerPageCursorHistory(requestedLedgerCursors);}
    }catch(currentRequestError){if(matchesCurrentSession())setCurrentLedgerNotice(currentRequestError as Error);}
    finally{if(matchesCurrentSession()){pendingRequestReference.current=false;setCurrentRequestPending(false);}}
  }
  useEffect(()=>{pendingRequestReference.current=false;setCurrentLedgerPage(null);return()=>{activeRequestSequence.current++;};},[gameSessionClient]);
  useEffect(()=>{if(isLedgerPanelActive)void loadHuntLedger(ledgerPageCursorHistory);},[gameSessionClient,isLedgerPanelActive]);
  return <section class="hunt-ledger-panel" aria-label={translateLedgerText('hunts.title')}>
    <h3>{translateLedgerText('hunts.title')}</h3>
    <p>{translateLedgerText('hunts.help')}</p>
    <button class="secondary compact" disabled={currentRequestPending} onClick={()=>void loadHuntLedger()}>{translateLedgerText('hunts.refresh')}</button>
    {currentRequestPending&&<p role="status">{translateLedgerText('hunts.loading')}</p>}
    {currentLedgerNotice&&<p role="alert">{noticeText(currentLedgerNotice,currentLocaleCode,translateLedgerText)}</p>}
    {currentLedgerPage&&<>
      <h4>{translateLedgerText('hunts.totals')}</h4>
      {!currentLedgerPage.totals.length?<p>{translateLedgerText('hunts.empty')}</p>:<ul>{currentLedgerPage.totals.map(currentSpeciesTotal=>
        <li key={currentSpeciesTotal.monsterTypeId}>{localizedHuntName(currentLedgerPage.monsterNames,currentSpeciesTotal.monsterTypeId,currentLocaleCode)} · {currentSpeciesTotal.quantity.toLocaleString(currentLocaleCode)}</li>)}</ul>}
      <h4>{translateLedgerText('hunts.page')}</h4>
      {(ledgerPageCursorHistory.length>1||currentLedgerPage.nextCursor!==null)&&<nav class="record-page-navigation" aria-label={translateLedgerText('hunts.pagination')}>
        <button class="secondary" disabled={currentRequestPending||ledgerPageCursorHistory.length===1} onClick={()=>void loadHuntLedger(ledgerPageCursorHistory.slice(0,-1))}>{translateLedgerText('hunts.previous')}</button>
        <span role="status">{translateLedgerText('hunts.pageNumber',{page:ledgerPageCursorHistory.length})}</span>
        <button class="secondary" disabled={currentRequestPending||currentLedgerPage.nextCursor===null} onClick={()=>void loadHuntLedger([...ledgerPageCursorHistory,currentLedgerPage.nextCursor!])}>{translateLedgerText('hunts.next')}</button>
      </nav>}
      {!currentLedgerPage.entries.length?<p>{translateLedgerText('hunts.emptyPage')}</p>:<ul class="bag-items">{currentLedgerPage.entries.map(currentLedgerEntry=>
        <li key={currentLedgerEntry.id} style={{overflowWrap:'anywhere'}}>
          <strong>{localizedHuntName(currentLedgerPage.monsterNames,currentLedgerEntry.monsterTypeId,currentLocaleCode)} × {currentLedgerEntry.quantity.toLocaleString(currentLocaleCode)}</strong>
          <p>{translateLedgerText('hunts.map')} · {localizedHuntName(currentLedgerPage.mapNames,currentLedgerEntry.mapId,currentLocaleCode)} | {translateLedgerText('hunts.result')} · {HUNT_RESULT_LABEL_KEYS[currentLedgerEntry.result]?translateLedgerText(HUNT_RESULT_LABEL_KEYS[currentLedgerEntry.result]):currentLedgerEntry.result}</p>
          <p>{translateLedgerText('hunts.battle')} · {currentLedgerEntry.battleId}</p>
          <time dateTime={new Date(currentLedgerEntry.createdAt*1000).toISOString()}>{new Date(currentLedgerEntry.createdAt*1000).toLocaleString(currentLocaleCode)}</time>
        </li>)}</ul>}
    </>}
  </section>;
}
