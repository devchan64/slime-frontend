import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {parseGuildMaterialCatalog,parseGuildMaterialQuote,validateGuildSaleReceipt,type GuildMaterialCatalog,type GuildMaterialQuote} from '../client/guildTrade';
import {useTranslation} from '../i18n';
import './guildTrade.css';

export function GuildTradePanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
  const {t:translateGuildText,locale:currentGuildLocale}=useTranslation();
  const [guildPanelOpened,setGuildPanelOpened]=useState(false);
  const [currentMaterialCatalog,setCurrentMaterialCatalog]=useState<GuildMaterialCatalog|null>(null);
  const [currentMaterialIdentifier,setCurrentMaterialIdentifier]=useState('');
  const [currentSaleQuantity,setCurrentSaleQuantity]=useState(1);
  const [currentSaleQuote,setCurrentSaleQuote]=useState<GuildMaterialQuote|null>(null);
  const [currentGuildNotice,setCurrentGuildNotice]=useState<Notice>('');
  const [guildRequestPending,setGuildRequestPending]=useState(false);
  const [guildSaleUncertain,setGuildSaleUncertain]=useState(false);
  const activeGuildReference=useRef(false);
  const pendingGuildReference=useRef(false);
  const originalSaleReference=useRef<Record<string,unknown>|null>(null);
  const originalSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,character:gameSessionClient.state?.me.id,
    location:gameSessionClient.state?.location.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
  const currentRequestBase=`/v1/game/guilds/${encodeURIComponent(currentFacilityIdentifier)}`;
  function guildSessionMatches(){return activeGuildReference.current&&gameSessionClient.tokens?.user_id===originalSessionReference.current.owner
    &&gameSessionClient.state?.generation===originalSessionReference.current.generation&&gameSessionClient.state?.me.id===originalSessionReference.current.character
    &&gameSessionClient.state?.location.id===originalSessionReference.current.location&&gameSessionClient.state?.me.mode==='FIELD'
    &&JSON.stringify(gameSessionClient.state?.me.position)===originalSessionReference.current.position;}
  async function runGuildRequest(currentRequestAction:()=>Promise<void>){
    if(actionsAreDisabled||pendingGuildReference.current||!guildSessionMatches())return;
    pendingGuildReference.current=true;setGuildRequestPending(true);setCurrentGuildNotice('');
    try{await currentRequestAction();}catch(currentRequestError){if(guildSessionMatches())setCurrentGuildNotice(currentRequestError as Error);}
    finally{pendingGuildReference.current=false;if(guildSessionMatches())setGuildRequestPending(false);}
  }
  async function loadGuildMaterials(){
    const currentReceivedCatalog=parseGuildMaterialCatalog(await gameSessionClient.request(`${currentRequestBase}/materials`));
    if(guildSessionMatches()){setCurrentMaterialCatalog(currentReceivedCatalog);setCurrentMaterialIdentifier('');setCurrentSaleQuantity(1);setCurrentSaleQuote(null);originalSaleReference.current=null;}
  }
  async function requestGuildQuote(){await runGuildRequest(async()=>{
    const currentReceivedQuote=parseGuildMaterialQuote(await gameSessionClient.request(`${currentRequestBase}/material-quote?materialId=${encodeURIComponent(currentMaterialIdentifier)}&quantity=${currentSaleQuantity}`),currentMaterialIdentifier,currentSaleQuantity);
    if(guildSessionMatches()){setCurrentSaleQuote(currentReceivedQuote);originalSaleReference.current={requestId:crypto.randomUUID(),expectedVersion:currentReceivedQuote.characterVersion,
      materialId:currentReceivedQuote.materialId,quantity:currentReceivedQuote.quantity,policyVersion:currentReceivedQuote.policyVersion,unitPriceP:currentReceivedQuote.unitPriceP};}
  });}
  async function confirmGuildSale(){await runGuildRequest(async()=>{
    const currentOriginalRequest=originalSaleReference.current;
    if(!currentOriginalRequest)return;
    let currentConfirmedReceipt=false;
    if(guildSaleUncertain){
      try{
        const currentStoredReceipt=await gameSessionClient.request(`/v1/game/guild-sales/${currentOriginalRequest.requestId}`);
        validateGuildSaleReceipt(currentStoredReceipt,currentOriginalRequest,currentFacilityIdentifier);currentConfirmedReceipt=true;
      }catch(currentRecoveryError){
        if(!(currentRecoveryError instanceof ApiError&&currentRecoveryError.status===404&&currentRecoveryError.code==='GUILD_SALE_NOT_FOUND'))throw currentRecoveryError;
      }
      if(!guildSessionMatches())return;
    }
    if(!currentConfirmedReceipt){
      try{
        const currentSaleResponse=await gameSessionClient.request(`${currentRequestBase}/material-sales`,currentOriginalRequest);
        validateGuildSaleReceipt(currentSaleResponse.receipt,currentOriginalRequest,currentFacilityIdentifier);
        if(!guildSessionMatches())return;
        gameSessionClient.accept(currentSaleResponse.state);
      }catch(currentSaleError){
        if(guildSessionMatches()){
          const currentOutcomeUncertain=!(currentSaleError instanceof ApiError)||currentSaleError.status>=500;
          setGuildSaleUncertain(currentOutcomeUncertain);
          if(!currentOutcomeUncertain){setCurrentSaleQuote(null);originalSaleReference.current=null;}
        }
        throw currentSaleError;
      }
    }
    if(!guildSessionMatches())return;
    setGuildSaleUncertain(false);setCurrentSaleQuote(null);originalSaleReference.current=null;
    setCurrentGuildNotice({key:'guild.sold'});
    if(currentConfirmedReceipt){const currentRecoveredState=await gameSessionClient.request('/v1/game/state');if(!guildSessionMatches())return;gameSessionClient.accept(currentRecoveredState);}
    await loadGuildMaterials();
  });}
  useEffect(()=>{activeGuildReference.current=true;return()=>{activeGuildReference.current=false;};},[]);
  const currentSelectedMaterial=currentMaterialCatalog?.items.find(currentMaterialEntry=>currentMaterialEntry.materialId===currentMaterialIdentifier);
  const currentMaximumQuantity=Math.min(currentSelectedMaterial?.quantity??0,currentMaterialCatalog?.maximumQuantity??0);
  const currentControlsDisabled=actionsAreDisabled||guildRequestPending||guildSaleUncertain;
  return <section class="guild-trade-panel">
    <button class="secondary compact" aria-expanded={guildPanelOpened} disabled={currentControlsDisabled} onClick={()=>{
      setGuildPanelOpened(!guildPanelOpened);if(!guildPanelOpened)void runGuildRequest(loadGuildMaterials);
    }}>{translateGuildText('guild.title')}</button>
    {guildPanelOpened&&<div>
      <p>{translateGuildText('guild.help')}</p>
      {currentMaterialCatalog&&!currentMaterialCatalog.items.length&&<p>{translateGuildText('guild.empty')}</p>}
      {!!currentMaterialCatalog?.items.length&&<>
        <label>{translateGuildText('guild.material')}<select value={currentMaterialIdentifier} disabled={currentControlsDisabled} onChange={currentInputEvent=>{
          setCurrentMaterialIdentifier(currentInputEvent.currentTarget.value);setCurrentSaleQuantity(1);setCurrentSaleQuote(null);originalSaleReference.current=null;
        }}><option value="">{translateGuildText('guild.choose')}</option>{currentMaterialCatalog.items.map(currentMaterialEntry=><option key={currentMaterialEntry.materialId} value={currentMaterialEntry.materialId}>
          {translateGuildText('guild.option',{name:currentMaterialEntry.nameTranslations[currentGuildLocale],count:currentMaterialEntry.quantity,price:currentMaterialEntry.unitPriceP})}
        </option>)}</select></label>
        {currentSelectedMaterial&&<label>{translateGuildText('guild.quantity',{max:currentMaximumQuantity})}<input type="number" min={1} max={currentMaximumQuantity} step={1}
          value={currentSaleQuantity} disabled={currentControlsDisabled} onInput={currentInputEvent=>{setCurrentSaleQuantity(Number(currentInputEvent.currentTarget.value));setCurrentSaleQuote(null);originalSaleReference.current=null;}}/></label>}
        <button class="secondary compact" disabled={currentControlsDisabled||!currentSelectedMaterial||!Number.isSafeInteger(currentSaleQuantity)||currentSaleQuantity<1||currentSaleQuantity>currentMaximumQuantity}
          onClick={()=>void requestGuildQuote()}>{translateGuildText('guild.quote')}</button>
      </>}
      {currentSaleQuote&&<div class="guild-sale-quote"><strong>{translateGuildText('guild.total',{count:currentSaleQuote.quantity,price:currentSaleQuote.totalPriceP})}</strong>
        <button class="compact" disabled={actionsAreDisabled||guildRequestPending} onClick={()=>void confirmGuildSale()}>{translateGuildText(guildSaleUncertain?'guild.retry':'guild.confirm')}</button></div>}
      {guildSaleUncertain&&<p role="status">{translateGuildText('guild.uncertain')}</p>}
      {guildRequestPending&&<p role="status">{translateGuildText('guild.pending')}</p>}
      {currentGuildNotice&&<p role="status">{noticeText(currentGuildNotice,currentGuildLocale,translateGuildText)}</p>}
    </div>}
  </section>;
}
