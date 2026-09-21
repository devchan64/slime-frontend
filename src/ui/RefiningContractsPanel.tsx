import {RefiningCreatePanel} from './RefiningCreatePanel';
import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseRefiningContracts,type RefiningContractPage} from '../client/refining';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

export function RefiningContractsPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}) {
  const {t:translateRefiningText,locale:currentRefiningLocale}=useTranslation();
  const [currentContractPage,setCurrentContractPage]=useState<RefiningContractPage|null>(null);
  const [currentRequestNotice,setCurrentRequestNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
    character:gameSessionClient.state?.me.id,location:gameSessionClient.state?.location.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
  const currentRequestBase=`/v1/game/workshops/${encodeURIComponent(currentFacilityIdentifier)}/refining-contracts`;
  function matchesRefiningSession() {
    const currentClientState=gameSessionClient.state;
    return activePanelReference.current && gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
      && currentClientState?.generation===initialSessionReference.current.generation && currentClientState?.me.id===initialSessionReference.current.character
      && currentClientState?.location.id===initialSessionReference.current.location && currentClientState?.me.mode==='FIELD'&&!currentClientState.me.battleId
      && JSON.stringify(currentClientState.me.position)===initialSessionReference.current.position;
  }
  async function loadRefiningContracts(currentPageCursor:string|null=null,currentContractIdentifier?:string) {
    if(actionsAreDisabled || pendingRequestReference.current || !matchesRefiningSession()) return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentRequestNotice('');
    try {
      if(currentContractIdentifier) {
        const currentClaimResponse=await gameSessionClient.request(`${currentRequestBase}/${encodeURIComponent(currentContractIdentifier)}/claim`,{expectedVersion:gameSessionClient.state!.me.version});
        if(!matchesRefiningSession()) return;
        gameSessionClient.accept(currentClaimResponse.state);
        if(!matchesRefiningSession()) return;
      }
      const currentReceivedPage=parseRefiningContracts(await gameSessionClient.request(currentRequestBase+(currentPageCursor?'?after='+encodeURIComponent(currentPageCursor):'')));
      if(matchesRefiningSession()) setCurrentContractPage(currentReceivedPage);
    } catch(currentRequestError) {if(matchesRefiningSession()) setCurrentRequestNotice(currentRequestError as Error);}
    finally {pendingRequestReference.current=false;if(matchesRefiningSession()) setCurrentRequestPending(false);}
  }
  useEffect(()=>{activePanelReference.current=true;return ()=>{activePanelReference.current=false;};},[]);
  return <section class="workshop-panel">
    <RefiningCreatePanel gameSessionClient={gameSessionClient} currentFacilityIdentifier={currentFacilityIdentifier} actionsAreDisabled={actionsAreDisabled||currentRequestPending}/>
    <h3>{translateRefiningText('workshop.refiningContracts')}</h3>
    <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void loadRefiningContracts()}>{translateRefiningText('journal.refresh')}</button>
    {currentRequestPending&&<p role="status">{translateRefiningText('workshop.pending')}</p>}
    {currentRequestNotice&&<p role="alert">{noticeText(currentRequestNotice,currentRefiningLocale,translateRefiningText)}</p>}
    {currentContractPage&&!currentContractPage.entries.length&&<p>{translateRefiningText('workshop.empty')}</p>}
    <ul>{currentContractPage?.entries.map(currentContractEntry=><li key={currentContractEntry.contractId}>
      <strong>{currentContractEntry.quote.outputMaterial[currentRefiningLocale==='ko'?'name':'englishName']} × {currentContractEntry.quote.outputQuantity}</strong>
      <p>{translateRefiningText(`workshop.${currentContractEntry.status.toLowerCase().replaceAll('_','')}`)}</p>
      <p>{translateRefiningText('workshop.paidTotal',{cost:currentContractEntry.quote.costP})}</p>
      <p>{translateRefiningText('workshop.readyAt',{time:new Date(currentContractEntry.readyAt*1000).toLocaleString(currentRefiningLocale)})}</p>
      {currentContractEntry.status==='READY'&&<button class="compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void loadRefiningContracts(null,currentContractEntry.contractId)}>{translateRefiningText('workshop.claim')}</button>}
    </li>)}</ul>
    {currentContractPage?.nextCursor&&<button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void loadRefiningContracts(currentContractPage.nextCursor)}>{translateRefiningText('workshop.next')}</button>}
  </section>;
}
