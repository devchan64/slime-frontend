import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseRefiningCatalog,parseRefiningQuote,type RefiningCatalogData,type RefiningQuoteData} from '../client/refining';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

const REFINING_MAXIMUM_QUANTITY=1000;
export function RefiningCreatePanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
 const {t:translateRefiningText,locale:currentRefiningLocale}=useTranslation();
 const [currentCatalogData,setCurrentCatalogData]=useState<RefiningCatalogData|null>(null);
 const [selectedRecipeIndex,setSelectedRecipeIndex]=useState(0);
 const [requestedOutputQuantity,setRequestedOutputQuantity]=useState(1);
 const [currentQuoteData,setCurrentQuoteData]=useState<RefiningQuoteData|null>(null);
 const [currentRequestNotice,setCurrentRequestNotice]=useState<Notice>('');
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const activePanelReference=useRef(false),pendingRequestReference=useRef(false);
 const currentCommandReference=useRef<{requestId:string;quote:RefiningQuoteData}|null>(null);
 const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
  character:gameSessionClient.state?.me.id,location:gameSessionClient.state?.location.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
 const currentRequestBase=`/v1/game/workshops/${encodeURIComponent(currentFacilityIdentifier)}/refining-`;
 function matchesRefiningSession(){const currentClientState=gameSessionClient.state;return activePanelReference.current&&gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
  &&currentClientState?.generation===initialSessionReference.current.generation&&currentClientState?.me.id===initialSessionReference.current.character
  &&currentClientState?.location.id===initialSessionReference.current.location&&currentClientState?.me.mode==='FIELD'&&!currentClientState.me.battleId
  &&JSON.stringify(currentClientState.me.position)===initialSessionReference.current.position;}
 async function executeRefiningRequest(currentActionName:'catalog'|'quote'|'create'){
  if(actionsAreDisabled||pendingRequestReference.current||!matchesRefiningSession())return;
  pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentRequestNotice('');
  try{
   if(currentActionName==='catalog'){
    const currentResponseData=parseRefiningCatalog(await gameSessionClient.request(currentRequestBase+'catalog'));
    if(matchesRefiningSession()){setCurrentCatalogData(currentResponseData);setSelectedRecipeIndex(0);setCurrentQuoteData(null);currentCommandReference.current=null;}
   }else if(currentActionName==='quote'){
    const currentRecipeEntry=currentCatalogData?.entries[selectedRecipeIndex];
    if(!currentRecipeEntry||!Number.isSafeInteger(requestedOutputQuantity)||requestedOutputQuantity<1||requestedOutputQuantity>REFINING_MAXIMUM_QUANTITY)return;
    setCurrentQuoteData(null);currentCommandReference.current=null;
    const currentQueryParameters=new URLSearchParams({collectionId:currentRecipeEntry.collectionId,grade:currentRecipeEntry.grade,quantity:String(requestedOutputQuantity)});
    const currentResponseData=parseRefiningQuote(await gameSessionClient.request(currentRequestBase+'quote?'+currentQueryParameters));
    if(matchesRefiningSession()){setCurrentQuoteData(currentResponseData);currentCommandReference.current={requestId:crypto.randomUUID(),quote:currentResponseData};}
   }else{
    const currentSavedCommand=currentCommandReference.current;
    if(!currentSavedCommand)return;
    const currentSavedQuote=currentSavedCommand.quote;
    const currentResponseData=await gameSessionClient.request(currentRequestBase+'contracts',{requestId:currentSavedCommand.requestId,expectedVersion:currentSavedQuote.characterVersion,
     collectionId:currentSavedQuote.quote.collectionId,grade:currentSavedQuote.quote.grade,quantity:currentSavedQuote.quote.outputQuantity,quoteToken:currentSavedQuote.quoteToken});
    if(matchesRefiningSession()){gameSessionClient.accept(currentResponseData.state);if(matchesRefiningSession()){currentCommandReference.current=null;setCurrentQuoteData(null);setCurrentRequestNotice(translateRefiningText('workshop.refiningCreated'));}}
   }
  }catch(currentRequestError){if(matchesRefiningSession())setCurrentRequestNotice(currentRequestError as Error);}
  finally{pendingRequestReference.current=false;if(matchesRefiningSession())setCurrentRequestPending(false);}
 }
 useEffect(()=>{activePanelReference.current=true;return()=>{activePanelReference.current=false;};},[]);
 const currentControlsDisabled=actionsAreDisabled||currentRequestPending;
 function clearRefiningQuote(){setCurrentQuoteData(null);currentCommandReference.current=null;}
 return <section class="workshop-panel">
  <h3>{translateRefiningText('workshop.refiningCreate')}</h3>
  <button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void executeRefiningRequest('catalog')}>{translateRefiningText('workshop.refiningBrowse')}</button>
  {currentCatalogData&&!currentCatalogData.available&&<p>{translateRefiningText('workshop.refiningUnavailable')}</p>}
  {!!currentCatalogData?.entries.length&&<>
   <label>{translateRefiningText('workshop.refiningRecipe')}<select disabled={currentControlsDisabled} value={selectedRecipeIndex} onChange={currentInputEvent=>{setSelectedRecipeIndex(Number(currentInputEvent.currentTarget.value));clearRefiningQuote();}}>
    {currentCatalogData.entries.map((currentRecipeEntry,currentRecipeIndex)=><option value={currentRecipeIndex}>{currentRecipeEntry.outputMaterial[currentRefiningLocale==='ko'?'name':'englishName']}</option>)}
   </select></label>
   <label>{translateRefiningText('workshop.refiningQuantity')}<input type="number" min={1} max={REFINING_MAXIMUM_QUANTITY} step={1} value={requestedOutputQuantity} disabled={currentControlsDisabled} onInput={currentInputEvent=>{setRequestedOutputQuantity(Number(currentInputEvent.currentTarget.value));clearRefiningQuote();}}/></label>
   <button class="compact" disabled={currentControlsDisabled||!Number.isSafeInteger(requestedOutputQuantity)||requestedOutputQuantity<1||requestedOutputQuantity>REFINING_MAXIMUM_QUANTITY} onClick={()=>void executeRefiningRequest('quote')}>{translateRefiningText('workshop.refiningQuote')}</button>
  </>}
  {currentQuoteData&&<div>
   <p>{translateRefiningText('workshop.refiningSummary',{input:currentQuoteData.quote.inputQuantity,owned:currentQuoteData.quote.ownedQuantity,cost:currentQuoteData.quote.costP,seconds:currentQuoteData.quote.durationSeconds})}</p>
   <button class="compact" disabled={currentControlsDisabled||currentQuoteData.ownedCoins<currentQuoteData.quote.costP||currentQuoteData.quote.ownedQuantity<currentQuoteData.quote.inputQuantity} onClick={()=>void executeRefiningRequest('create')}>{translateRefiningText('workshop.refiningSubmit')}</button>
  </div>}
  {currentRequestPending&&<p role="status">{translateRefiningText('workshop.pending')}</p>}
  {currentRequestNotice&&<p role="status">{noticeText(currentRequestNotice,currentRefiningLocale,translateRefiningText)}</p>}
 </section>;
}
