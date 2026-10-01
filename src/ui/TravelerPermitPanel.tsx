import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {parseTravelerPermitQuote,validateTravelerPurchaseReceipt,type GuardCenterRecord} from '../client/travelerIssuance';
import {useTranslation} from '../i18n';

const TRAVELER_PRICE_TICK_MS=1000;
type TravelerPriceQuote={price:number;deadline:number;policyVersion:number;quotedExpiresAt:number;characterVersion:number};
export function TravelerPermitPanel({gameSessionClient,currentGuardDefinition,actionsAreDisabled}:{gameSessionClient:Client;currentGuardDefinition:GuardCenterRecord;actionsAreDisabled:boolean}){
  const {t:translateTravelerText,locale:currentTravelerLocale}=useTranslation();
  const [currentPriceQuote,setCurrentPriceQuote]=useState<TravelerPriceQuote|null>(null);
  const [currentRemainingSeconds,setCurrentRemainingSeconds]=useState(0);
  const [currentPriceNotice,setCurrentPriceNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const [currentPurchaseUncertain,setCurrentPurchaseUncertain]=useState(false);
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const originalPurchaseReference=useRef<Record<string,unknown>|null>(null);
  const originalSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
    character:gameSessionClient.state?.me.id,position:JSON.stringify(gameSessionClient.state?.me.position),map:gameSessionClient.state?.map.id});
  function travelerSessionMatches(){return activePanelReference.current&&gameSessionClient.tokens?.user_id===originalSessionReference.current.owner
    &&gameSessionClient.state?.generation===originalSessionReference.current.generation&&gameSessionClient.state?.me.id===originalSessionReference.current.character
    &&gameSessionClient.state?.map.id===originalSessionReference.current.map&&gameSessionClient.state?.me.mode==='FIELD'&&!gameSessionClient.state?.me.battleId
    &&JSON.stringify(gameSessionClient.state?.me.position)===originalSessionReference.current.position;}
  async function requestTravelerPrice(){
    if(actionsAreDisabled||pendingRequestReference.current||originalPurchaseReference.current||!travelerSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentPriceNotice('');setCurrentPriceQuote(null);
    const currentRequestStarted=performance.now();
    try{
      const currentReceivedQuote=parseTravelerPermitQuote(await gameSessionClient.request(`/v1/game/guard-centers/${encodeURIComponent(currentGuardDefinition.id)}/traveler-permit-quote`),currentGuardDefinition);
      if(travelerSessionMatches()){
        // 브라우저 시계 대신 단조 시각을 쓰고 왕복 지연을 포함해 보수적으로 만료시킨다.
        const currentQuoteDeadline=currentRequestStarted+(currentReceivedQuote.expiresAt-currentReceivedQuote.serverTime)*1000;
        setCurrentPriceQuote({price:currentReceivedQuote.priceP,deadline:currentQuoteDeadline,policyVersion:currentReceivedQuote.policyVersion,
          quotedExpiresAt:currentReceivedQuote.expiresAt,characterVersion:gameSessionClient.state!.me.version});
        setCurrentRemainingSeconds(Math.max(0,Math.ceil((currentQuoteDeadline-performance.now())/1000)));
        originalPurchaseReference.current=null;setCurrentPurchaseUncertain(false);
      }
    }catch(currentRequestError){if(travelerSessionMatches())setCurrentPriceNotice(currentRequestError as Error);}
    finally{pendingRequestReference.current=false;if(travelerSessionMatches())setCurrentRequestPending(false);}
  }
  async function confirmTravelerPurchase(){
    if(actionsAreDisabled||pendingRequestReference.current||!travelerSessionMatches()||!currentPriceQuote||(!currentPurchaseUncertain&&performance.now()>=currentPriceQuote.deadline))return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentPriceNotice('');
    const currentOriginalRequest=originalPurchaseReference.current??{requestId:crypto.randomUUID(),expectedVersion:currentPriceQuote.characterVersion,
      policyVersion:currentPriceQuote.policyVersion,priceP:currentPriceQuote.price,quotedExpiresAt:currentPriceQuote.quotedExpiresAt};
    originalPurchaseReference.current=currentOriginalRequest;
    try{
      const currentPurchaseResponse=await gameSessionClient.request(`/v1/game/guard-centers/${encodeURIComponent(currentGuardDefinition.id)}/traveler-permit-purchases`,currentOriginalRequest);
      validateTravelerPurchaseReceipt(currentPurchaseResponse.receipt,currentOriginalRequest,currentGuardDefinition,originalSessionReference.current.character!);
      if(currentPurchaseResponse.state?.me?.id!==originalSessionReference.current.character || currentPurchaseResponse.state?.generation!==originalSessionReference.current.generation) throw new Error("발급 응답의 캐릭터·세션이 다릅니다.");
      if(!travelerSessionMatches())return;
      gameSessionClient.accept(currentPurchaseResponse.state);
      setCurrentPriceQuote(null);originalPurchaseReference.current=null;setCurrentPurchaseUncertain(false);
      setCurrentPriceNotice({key:'citizenship.permitPurchased'});
    }catch(currentPurchaseError){
      if(travelerSessionMatches()){
        const currentOutcomeUncertain=!(currentPurchaseError instanceof ApiError)||currentPurchaseError.status>=500;
        setCurrentPurchaseUncertain(currentOutcomeUncertain);
        if(!currentOutcomeUncertain){setCurrentPriceQuote(null);originalPurchaseReference.current=null;}
        setCurrentPriceNotice(currentPurchaseError as Error);
      }
    }finally{pendingRequestReference.current=false;if(travelerSessionMatches())setCurrentRequestPending(false);}
  }
  useEffect(()=>{activePanelReference.current=true;return()=>{activePanelReference.current=false;};},[]);
  useEffect(()=>{
    if(!currentPriceQuote)return;
    const currentRefreshTimer=window.setInterval(()=>setCurrentRemainingSeconds(Math.max(0,Math.ceil((currentPriceQuote.deadline-performance.now())/1000))),TRAVELER_PRICE_TICK_MS);
    return()=>window.clearInterval(currentRefreshTimer);
  },[currentPriceQuote]);
  return <section class="guild-trade-panel" aria-label={currentGuardDefinition.name}>
    <h3>{currentGuardDefinition.name}</h3>
    <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending||currentPurchaseUncertain} onClick={()=>void requestTravelerPrice()}>{translateTravelerText('citizenship.permitPrice')}</button>
    {currentPriceQuote&&<div>{currentRemainingSeconds>0?<p>{translateTravelerText('citizenship.permitQuote',{price:currentPriceQuote.price,seconds:currentRemainingSeconds})}</p>
      :<p role="status">{translateTravelerText('citizenship.permitExpired')}</p>}
      {(currentRemainingSeconds>0||currentPurchaseUncertain)&&<><small>{translateTravelerText('citizenship.permitPurchaseHelp',{price:currentPriceQuote.price})}</small>
        <button class="compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void confirmTravelerPurchase()}>{translateTravelerText(currentPurchaseUncertain?'citizenship.permitRetry':'citizenship.permitPurchase')}</button></>}</div>}
    {currentPurchaseUncertain&&<p role="status">{translateTravelerText('citizenship.permitUncertain')}</p>}
    {currentRequestPending&&<p role="status">{translateTravelerText('guild.pending')}</p>}
    {currentPriceNotice&&<p role="status">{noticeText(currentPriceNotice,currentTravelerLocale,translateTravelerText)}</p>}
  </section>;
}
