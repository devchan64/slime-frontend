import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {noticeText,type Notice} from '../client/notice';
import {parseCitizenshipPriceQuote} from '../client/guildTrade';
import {useTranslation} from '../i18n';

const CITIZENSHIP_PRICE_TICK_MS=1000;
export function CitizenshipPricePanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
  const {t:translateCitizenshipText,locale:currentCitizenshipLocale}=useTranslation();
  const [currentPriceQuote,setCurrentPriceQuote]=useState<{price:number;deadline:number}|null>(null);
  const [currentRemainingSeconds,setCurrentRemainingSeconds]=useState(0);
  const [currentPriceNotice,setCurrentPriceNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const originalSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
    character:gameSessionClient.state?.me.id,position:JSON.stringify(gameSessionClient.state?.me.position),map:gameSessionClient.state?.map.id});
  function citizenshipSessionMatches(){return activePanelReference.current&&gameSessionClient.tokens?.user_id===originalSessionReference.current.owner
    &&gameSessionClient.state?.generation===originalSessionReference.current.generation&&gameSessionClient.state?.me.id===originalSessionReference.current.character
    &&gameSessionClient.state?.map.id===originalSessionReference.current.map&&gameSessionClient.state?.me.mode==='FIELD'
    &&JSON.stringify(gameSessionClient.state?.me.position)===originalSessionReference.current.position;}
  async function requestCitizenshipPrice(){
    if(actionsAreDisabled||pendingRequestReference.current||!citizenshipSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentPriceNotice('');setCurrentPriceQuote(null);
    const currentRequestStarted=performance.now();
    try{
      const currentReceivedQuote=parseCitizenshipPriceQuote(await gameSessionClient.request(`/v1/game/guilds/${encodeURIComponent(currentFacilityIdentifier)}/citizenship-quote`),originalSessionReference.current.map!);
      if(citizenshipSessionMatches()){
        // 브라우저 시계 대신 단조 시각을 쓰고 왕복 지연을 포함해 보수적으로 만료시킨다.
        const currentQuoteDeadline=currentRequestStarted+(currentReceivedQuote.expiresAt-currentReceivedQuote.serverTime)*1000;
        setCurrentPriceQuote({price:currentReceivedQuote.priceP,deadline:currentQuoteDeadline});
        setCurrentRemainingSeconds(Math.max(0,Math.ceil((currentQuoteDeadline-performance.now())/1000)));
      }
    }catch(currentRequestError){if(citizenshipSessionMatches())setCurrentPriceNotice(currentRequestError as Error);}
    finally{pendingRequestReference.current=false;if(citizenshipSessionMatches())setCurrentRequestPending(false);}
  }
  useEffect(()=>{activePanelReference.current=true;return()=>{activePanelReference.current=false;};},[]);
  useEffect(()=>{
    if(!currentPriceQuote)return;
    const currentRefreshTimer=window.setInterval(()=>setCurrentRemainingSeconds(Math.max(0,Math.ceil((currentPriceQuote.deadline-performance.now())/1000))),CITIZENSHIP_PRICE_TICK_MS);
    return()=>window.clearInterval(currentRefreshTimer);
  },[currentPriceQuote]);
  return <section class="guild-trade-panel">
    <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void requestCitizenshipPrice()}>{translateCitizenshipText('guild.citizenshipPrice')}</button>
    {currentPriceQuote&&<div>{currentRemainingSeconds>0?<p>{translateCitizenshipText('guild.citizenshipQuote',{price:currentPriceQuote.price,seconds:currentRemainingSeconds})}</p>
      :<p role="status">{translateCitizenshipText('guild.citizenshipExpired')}</p>}
      <small>{translateCitizenshipText('guild.citizenshipReadOnly')}</small></div>}
    {currentRequestPending&&<p role="status">{translateCitizenshipText('guild.pending')}</p>}
    {currentPriceNotice&&<p role="status">{noticeText(currentPriceNotice,currentCitizenshipLocale,translateCitizenshipText)}</p>}
  </section>;
}
