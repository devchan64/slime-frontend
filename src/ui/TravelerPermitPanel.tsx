import {captureFacilitySessionContext,matchesFacilitySessionContext} from '../client/facilitySessionContext';
import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {parseTravelerBarterQuote,type TravelerBarterPayment,parseTravelerPermitQuote,validateTravelerPurchaseReceipt,type GuardCenterRecord} from '../client/travelerIssuance';
import {useTranslation} from '../i18n';

const TRAVELER_PRICE_TICK_MS=1000;
type TravelerPriceQuote={price:number;deadline:number;policyVersion:number;quotedExpiresAt:number;characterVersion:number;payment?:TravelerBarterPayment};
export function TravelerPermitPanel({gameSessionClient,currentGuardDefinition,actionsAreDisabled}:{gameSessionClient:Client;currentGuardDefinition:GuardCenterRecord;actionsAreDisabled:boolean}){
  const {t:translateTravelerText,locale:currentTravelerLocale}=useTranslation();
  const [currentPriceQuote,setCurrentPriceQuote]=useState<TravelerPriceQuote|null>(null);
  const [currentRemainingSeconds,setCurrentRemainingSeconds]=useState(0);
  const [currentPriceNotice,setCurrentPriceNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const [currentPurchaseUncertain,setCurrentPurchaseUncertain]=useState(false);
  const [currentBarterEnabled,setCurrentBarterEnabled]=useState(false);
  const [currentCashSelection,setCurrentCashSelection]=useState('0');
  const [currentMaterialSelection,setCurrentMaterialSelection]=useState<Record<string,string>>({});
  const currentMaterialEntries=(gameSessionClient.state?.me.bag?.items??[]).filter(currentMaterialEntry=>['material','refined_material'].includes(currentMaterialEntry.kind));
  function invalidateTravelerSelection(){setCurrentPriceQuote(null);setCurrentPriceNotice('');}
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const originalPurchaseReference=useRef<Record<string,unknown>|null>(null);
  const originalSessionReference=useRef(captureFacilitySessionContext(gameSessionClient));
  function travelerSessionMatches(){return activePanelReference.current&&matchesFacilitySessionContext(gameSessionClient,originalSessionReference.current);}
  async function requestTravelerPrice(){
    if(actionsAreDisabled||pendingRequestReference.current||originalPurchaseReference.current||!travelerSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentPriceNotice('');setCurrentPriceQuote(null);
    const currentRequestStarted=performance.now();
    const currentCharacterVersion=gameSessionClient.state!.me.version;
    try{
      let currentPaymentSelection: {cashP:number;materials:Record<string,number>}|undefined;
      if(currentBarterEnabled){
        const currentSelectedMaterials:Record<string,number>={};
        if(!/^(0|[1-9][0-9]*)$/.test(currentCashSelection)||!Number.isSafeInteger(Number(currentCashSelection)))throw new Error(translateTravelerText('citizenship.barterInvalid'));
        for(const currentMaterialEntry of currentMaterialEntries){
          const currentQuantityText=currentMaterialSelection[currentMaterialEntry.id]??'0';
          if(!/^(0|[1-9][0-9]*)$/.test(currentQuantityText)||!Number.isSafeInteger(Number(currentQuantityText))||Number(currentQuantityText)>currentMaterialEntry.quantity)throw new Error(translateTravelerText('citizenship.barterInvalid'));
          if(Number(currentQuantityText)>0)currentSelectedMaterials[currentMaterialEntry.id]=Number(currentQuantityText);
        }
        if(!Object.keys(currentSelectedMaterials).length)throw new Error(translateTravelerText('citizenship.barterInvalid'));
        currentPaymentSelection={cashP:Number(currentCashSelection),materials:currentSelectedMaterials};
      }
      const currentRequestPath=`/v1/game/guard-centers/${encodeURIComponent(currentGuardDefinition.id)}/traveler-permit-${currentPaymentSelection?'barter-quote':'quote'}`;
      const currentResponseValue=await gameSessionClient.request(currentRequestPath,currentPaymentSelection);
      const currentReceivedQuote: ReturnType<typeof parseTravelerPermitQuote> & {payment?:TravelerBarterPayment}=currentPaymentSelection
        ?parseTravelerBarterQuote(currentResponseValue,currentGuardDefinition,currentPaymentSelection):parseTravelerPermitQuote(currentResponseValue,currentGuardDefinition);
      if(travelerSessionMatches()&&gameSessionClient.state!.me.version===currentCharacterVersion){
        // 브라우저 시계 대신 단조 시각을 쓰고 왕복 지연을 포함해 보수적으로 만료시킨다.
        const currentQuoteDeadline=currentRequestStarted+(currentReceivedQuote.expiresAt-currentReceivedQuote.serverTime)*1000;
        setCurrentPriceQuote({price:currentReceivedQuote.priceP,deadline:currentQuoteDeadline,policyVersion:currentReceivedQuote.policyVersion,
          quotedExpiresAt:currentReceivedQuote.expiresAt,characterVersion:currentCharacterVersion,payment:currentReceivedQuote.payment});
        setCurrentRemainingSeconds(Math.max(0,Math.ceil((currentQuoteDeadline-performance.now())/1000)));
        originalPurchaseReference.current=null;setCurrentPurchaseUncertain(false);
      }
    }catch(currentRequestError){if(travelerSessionMatches())setCurrentPriceNotice(currentRequestError as Error);}
    finally{pendingRequestReference.current=false;if(travelerSessionMatches())setCurrentRequestPending(false);}
  }
  async function confirmTravelerPurchase(){
    if(actionsAreDisabled||pendingRequestReference.current||!travelerSessionMatches()||!currentPriceQuote||(!currentPurchaseUncertain&&gameSessionClient.state!.me.version!==currentPriceQuote.characterVersion)||(!currentPurchaseUncertain&&performance.now()>=currentPriceQuote.deadline))return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentPriceNotice('');
    const currentOriginalRequest=originalPurchaseReference.current??{requestId:crypto.randomUUID(),expectedVersion:currentPriceQuote.characterVersion,
      policyVersion:currentPriceQuote.policyVersion,priceP:currentPriceQuote.price,quotedExpiresAt:currentPriceQuote.quotedExpiresAt,...(currentPriceQuote.payment?{payment:currentPriceQuote.payment}:{})};
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
    <fieldset disabled={actionsAreDisabled||currentRequestPending||currentPurchaseUncertain}>
      <label class="traveler-barter-toggle"><input type="checkbox" checked={currentBarterEnabled} onChange={currentInputEvent=>{setCurrentBarterEnabled(currentInputEvent.currentTarget.checked);invalidateTravelerSelection();}}/>{translateTravelerText('citizenship.barterEnable')}</label>
      {currentBarterEnabled&&<>
        <label>{translateTravelerText('citizenship.barterCash')}<input type="number" min="0" step="1" value={currentCashSelection} onInput={currentInputEvent=>{setCurrentCashSelection(currentInputEvent.currentTarget.value);invalidateTravelerSelection();}}/></label>
        {currentMaterialEntries.length===0&&<p>{translateTravelerText('citizenship.barterEmpty')}</p>}
        {currentMaterialEntries.map(currentMaterialEntry=><label key={currentMaterialEntry.id}>{currentMaterialEntry.nameTranslations[currentTravelerLocale]} ({currentMaterialEntry.quantity})
          <input type="number" min="0" max={currentMaterialEntry.quantity} step="1" value={currentMaterialSelection[currentMaterialEntry.id]??'0'} onInput={currentInputEvent=>{setCurrentMaterialSelection({...currentMaterialSelection,[currentMaterialEntry.id]:currentInputEvent.currentTarget.value});invalidateTravelerSelection();}}/>
        </label>)}
      </>}
    </fieldset>
    <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending||currentPurchaseUncertain} onClick={()=>void requestTravelerPrice()}>{translateTravelerText('citizenship.permitPrice')}</button>
    {currentPriceQuote?.payment&&<div>
      <p>{translateTravelerText('citizenship.barterCashValue',{cash:currentPriceQuote.payment.cashP})}</p>
      {Object.entries(currentPriceQuote.payment.materials).map(([currentMaterialIdentifier,currentMaterialQuantity])=><p key={currentMaterialIdentifier}>{translateTravelerText('citizenship.barterMaterialValue',{name:currentMaterialEntries.find(currentMaterialEntry=>currentMaterialEntry.id===currentMaterialIdentifier)?.nameTranslations[currentTravelerLocale]??currentMaterialIdentifier,quantity:currentMaterialQuantity,value:currentPriceQuote.payment!.materialValues[currentMaterialIdentifier]})}</p>)}
      <p>{translateTravelerText('citizenship.barterTotal',{total:currentPriceQuote.payment.totalValueP,excess:currentPriceQuote.payment.excessValueP})}</p>
    </div>}
    {currentPriceQuote&&<div>{currentRemainingSeconds>0?<p>{translateTravelerText('citizenship.permitQuote',{price:currentPriceQuote.price,seconds:currentRemainingSeconds})}</p>
      :<p role="status">{translateTravelerText('citizenship.permitExpired')}</p>}
      {(currentRemainingSeconds>0||currentPurchaseUncertain)&&<><small>{translateTravelerText(currentPriceQuote.payment?'citizenship.barterPurchaseHelp':'citizenship.permitPurchaseHelp',{price:currentPriceQuote.price})}</small>
        <button class="compact" disabled={actionsAreDisabled||currentRequestPending||(!currentPurchaseUncertain&&gameSessionClient.state?.me.version!==currentPriceQuote.characterVersion)} onClick={()=>void confirmTravelerPurchase()}>{translateTravelerText(currentPurchaseUncertain?'citizenship.permitRetry':'citizenship.permitPurchase')}</button></>}</div>}
    {currentPriceQuote&&!currentPurchaseUncertain&&gameSessionClient.state?.me.version!==currentPriceQuote.characterVersion&&<p role="status">{translateTravelerText('citizenship.barterStateChanged')}</p>}
    {currentPurchaseUncertain&&<p role="status">{translateTravelerText('citizenship.permitUncertain')}</p>}
    {currentRequestPending&&<p role="status">{translateTravelerText('guild.pending')}</p>}
    {currentPriceNotice&&<p role="status">{noticeText(currentPriceNotice,currentTravelerLocale,translateTravelerText)}</p>}
  </section>;
}
