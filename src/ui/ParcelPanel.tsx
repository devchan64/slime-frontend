import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {validateNamedParcelListing,validateParcelReceipt,type ParcelListing,type ParcelAttachment} from '../client/parcel-validation.mjs';
import {useTranslation} from '../i18n';

const PARCEL_EXPIRATION_REFRESH_MILLISECONDS=1000;

export function ParcelPanel({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}){
 const {t:translateParcelText,locale:currentParcelLocale}=useTranslation();
 const [parcelPageCursorHistory,setParcelPageCursorHistory]=useState<(string|null)[]>([null]);
 const [currentParcelListing,setCurrentParcelListing]=useState<ParcelListing|null>(null);
 const [currentParcelNotice,setCurrentParcelNotice]=useState<Notice>('');
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const [currentUncertainParcel,setCurrentUncertainParcel]=useState<string|null>(null);
 const currentListingClock=useRef<{serverTime:number;receivedAt:number}|null>(null);
 const [currentDisplayTime,setCurrentDisplayTime]=useState(0);
 function readParcelServerTime(){return currentListingClock.current?currentListingClock.current.serverTime+(performance.now()-currentListingClock.current.receivedAt)/1000:0;}
 const currentActiveReference=useRef(false);
 const currentPendingReference=useRef(false);
 const currentOriginalRequest=useRef<{parcelId:string;expectedVersion:number;attachments:ParcelAttachment[]}|null>(null);
 const currentInitialContext=useRef({owner:gameSessionClient.tokens?.user_id,character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation});
 function parcelContextMatches(){return currentActiveReference.current&&!!gameSessionClient.state&&gameSessionClient.tokens?.user_id===currentInitialContext.current.owner&&gameSessionClient.state.me.id===currentInitialContext.current.character&&gameSessionClient.state.generation===currentInitialContext.current.generation;}
 const currentEndpointPrefix='/v1/accounts/me/parcels';
 async function loadParcelListing(requestedCursorHistory:(string|null)[]=[null]){
  if(actionsAreDisabled||currentPendingReference.current||currentOriginalRequest.current||!parcelContextMatches())return;
  currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentParcelNotice('');
  try{
   const currentAfterCursor=requestedCursorHistory[requestedCursorHistory.length-1];
   const currentResponseRecord=validateNamedParcelListing(await gameSessionClient.request(currentEndpointPrefix+'?includeNames=true'+(currentAfterCursor?'&after='+encodeURIComponent(currentAfterCursor):'')));
   if(parcelContextMatches()){currentListingClock.current={serverTime:currentResponseRecord.serverTime,receivedAt:performance.now()};setCurrentDisplayTime(currentResponseRecord.serverTime);setCurrentParcelListing(currentResponseRecord);setParcelPageCursorHistory(requestedCursorHistory);}
  }catch(currentRequestError){if(parcelContextMatches())setCurrentParcelNotice(currentRequestError as Error);}
  finally{currentPendingReference.current=false;if(parcelContextMatches())setCurrentRequestPending(false);}
 }
 async function claimParcelEntry(currentParcelIdentifier:string){
  if(actionsAreDisabled||currentPendingReference.current||!parcelContextMatches()||(!currentOriginalRequest.current&&!currentParcelListing))return;
  if(!currentOriginalRequest.current){
   const currentSelectedParcel=currentParcelListing!.entries.find(currentParcelEntry=>currentParcelEntry.parcelId===currentParcelIdentifier);
   if(!currentSelectedParcel||currentSelectedParcel.expiresAt<=readParcelServerTime()){setCurrentDisplayTime(readParcelServerTime());setCurrentParcelNotice({key:'parcels.expired'});return;}
  }
  const currentRequestRecord=currentOriginalRequest.current??{parcelId:currentParcelIdentifier,expectedVersion:currentParcelListing!.characterVersion,attachments:structuredClone(currentParcelListing!.entries.find(currentParcelEntry=>currentParcelEntry.parcelId===currentParcelIdentifier)!.attachments)};
  if(currentRequestRecord.parcelId!==currentParcelIdentifier)return;
  currentOriginalRequest.current=currentRequestRecord;currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentParcelNotice('');
  try{
   const currentResponseRecord=await gameSessionClient.request(currentEndpointPrefix+'/'+currentParcelIdentifier+'/claim',{expectedVersion:currentRequestRecord.expectedVersion});
   validateParcelReceipt(currentResponseRecord.receipt,currentParcelIdentifier,gameSessionClient.state!.me.id,currentRequestRecord.attachments);
   if(currentResponseRecord.state?.me?.id!==gameSessionClient.state?.me.id||currentResponseRecord.state?.generation!==gameSessionClient.state?.generation)throw new Error('소포 수령 응답의 캐릭터·세션이 다릅니다.');
   if(!parcelContextMatches())return;
   gameSessionClient.accept(currentResponseRecord.state);
   currentOriginalRequest.current=null;setCurrentUncertainParcel(null);setCurrentParcelListing(null);setCurrentParcelNotice({key:'parcels.received'});
  }catch(currentRequestError){if(parcelContextMatches()){
   const currentOutcomeUncertain=!(currentRequestError instanceof ApiError)||currentRequestError.status>=500;
   setCurrentUncertainParcel(currentOutcomeUncertain?currentParcelIdentifier:null);
   if(!currentOutcomeUncertain){currentOriginalRequest.current=null;setCurrentParcelListing(null);}
   setCurrentParcelNotice(currentRequestError as Error);
  }}finally{currentPendingReference.current=false;if(parcelContextMatches())setCurrentRequestPending(false);}
 }
 function formatParcelAttachment(currentAttachmentRecord:ParcelAttachment,currentAttachmentNames:{ko:string;en:string}|null){
  if(currentAttachmentRecord.kind==='money')return translateParcelText('parcels.money',{amount:currentAttachmentRecord.amountP});
  if(currentAttachmentRecord.kind==='costume')return translateParcelText('parcels.costume',{name:currentAttachmentNames![currentParcelLocale]});
  return translateParcelText('parcels.item',{name:currentAttachmentNames![currentParcelLocale],quantity:currentAttachmentRecord.quantity});
 }
 useEffect(()=>{
  if(!currentParcelListing)return;
  const currentExpirationTimer=window.setInterval(()=>setCurrentDisplayTime(readParcelServerTime()),PARCEL_EXPIRATION_REFRESH_MILLISECONDS);
  return()=>window.clearInterval(currentExpirationTimer);
 },[currentParcelListing]);
 useEffect(()=>{currentActiveReference.current=true;return()=>{currentActiveReference.current=false;};},[]);
 useEffect(()=>{if(!currentParcelListing)void loadParcelListing();},[actionsAreDisabled]);
 return <section class="guild-trade-panel" aria-label={translateParcelText('parcels.title')}>
  <h3>{translateParcelText('parcels.title')}</h3><p>{translateParcelText('parcels.help')}</p>
  <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending||!!currentUncertainParcel} onClick={()=>void loadParcelListing()}>{translateParcelText('parcels.refresh')}</button>
  {currentParcelListing?.entries.length===0&&<p>{translateParcelText('parcels.empty')}</p>}
  {currentParcelListing?.entries.map(currentParcelEntry=><article key={currentParcelEntry.parcelId}>
   <ul>{currentParcelEntry.attachments.map((currentAttachmentRecord,currentAttachmentIndex)=><li key={currentAttachmentIndex}>{formatParcelAttachment(currentAttachmentRecord,currentParcelEntry.attachmentNames![currentAttachmentIndex])}</li>)}</ul>
   <p>{translateParcelText('parcels.expires',{time:new Date(currentParcelEntry.expiresAt*1000).toLocaleString(currentParcelLocale)})}</p>
   {currentParcelEntry.expiresAt<=currentDisplayTime&&<p>{translateParcelText('parcels.expired')}</p>}
   <button class="compact" disabled={actionsAreDisabled||currentRequestPending||!!currentUncertainParcel||currentParcelEntry.expiresAt<=currentDisplayTime} onClick={()=>void claimParcelEntry(currentParcelEntry.parcelId)}>{translateParcelText('parcels.claim')}</button>
  </article>)}
  {currentParcelListing&&<nav class="account-storage-categories" aria-label={translateParcelText('parcels.pagination')}>
   <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending||!!currentUncertainParcel||parcelPageCursorHistory.length<=1} onClick={()=>void loadParcelListing(parcelPageCursorHistory.slice(0,-1))}>{translateParcelText('parcels.previous')}</button>
   <span role="status">{translateParcelText('parcels.page',{page:parcelPageCursorHistory.length})}</span>
   <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending||!!currentUncertainParcel||!currentParcelListing.nextCursor} onClick={()=>void loadParcelListing([...parcelPageCursorHistory,currentParcelListing.nextCursor])}>{translateParcelText('parcels.next')}</button>
  </nav>}
  {currentUncertainParcel&&<><p>{translateParcelText('parcels.uncertain')}</p><button disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void claimParcelEntry(currentUncertainParcel)}>{translateParcelText('parcels.retry')}</button></>}
  {currentRequestPending&&<p role="status">{translateParcelText('parcels.pending')}</p>}
  {currentParcelNotice&&<p role="status">{noticeText(currentParcelNotice,currentParcelLocale,translateParcelText)}</p>}
 </section>;
}
