import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

export function DeveloperResetPanel({currentGameClient,currentActionsDisabled,onResetPendingChange,onResetCompleted}:{currentGameClient:Client;currentActionsDisabled:boolean;onResetPendingChange?:(currentPendingValue:boolean)=>void;onResetCompleted?:()=>void}) {
 const {t:translateResetText,locale:currentDisplayLocale}=useTranslation();
 const [currentConfirmationText,setCurrentConfirmationText]=useState('');
 const [currentRequestBusy,setCurrentRequestBusy]=useState(false);
 const [currentPendingReset,setCurrentPendingReset]=useState<{requestId:string;expectedVersion:number;confirmation:'RESET test'}|null>(null);
 const [currentNoticeMessage,setCurrentNoticeMessage]=useState<Notice>('');
 const currentResetDialog=useRef<HTMLDialogElement>(null);
 const currentResetButton=useRef<HTMLButtonElement>(null);
 const currentActiveReference=useRef(true);
 const currentBusyReference=useRef(false);
 const currentOwnerReference=useRef({account:currentGameClient.tokens?.user_id,generation:currentGameClient.state?.generation});
 useEffect(()=>()=>{currentActiveReference.current=false;},[]);
 function closeResetConfirmation(){currentResetDialog.current?.close();currentResetButton.current?.focus();}
 async function submitCharacterReset(){
  if(currentBusyReference.current)return;
  const currentResetPayload=currentPendingReset??{requestId:crypto.randomUUID(),expectedVersion:currentGameClient.state!.me.version,confirmation:'RESET test' as const};
  currentBusyReference.current=true;setCurrentRequestBusy(true);setCurrentPendingReset(currentResetPayload);onResetPendingChange?.(true);
  try {
   const currentResetReceipt=await currentGameClient.request('/v1/developer/character-reset',currentResetPayload);
   if(!currentActiveReference.current||currentOwnerReference.current.account!==currentGameClient.tokens?.user_id||currentOwnerReference.current.generation!==currentGameClient.state?.generation)return;
   if(currentResetReceipt?.ok!==true||currentResetReceipt.requestId!==currentResetPayload.requestId||currentResetReceipt.requiresLogin!==true)throw new Error(translateResetText('app.developerInvalid'));
   setCurrentPendingReset(null);setCurrentNoticeMessage('');onResetPendingChange?.(false);
   currentGameClient.disconnect();currentGameClient.tokens=null;currentGameClient.state=null;
   if(onResetCompleted)onResetCompleted();else {window.location.hash='#/characters';window.location.reload();}
  } catch(currentResetError) {
   if(!currentActiveReference.current)return;
   if(currentResetError instanceof ApiError&&currentResetError.status<500){setCurrentPendingReset(null);onResetPendingChange?.(false);}
   setCurrentNoticeMessage(currentResetError instanceof Error?currentResetError:translateResetText('app.developerResetUncertain'));
  } finally {currentBusyReference.current=false;if(currentActiveReference.current)setCurrentRequestBusy(false);}
 }
 return <section aria-label={translateResetText('app.developerResetTitle')}>
  <h3>{translateResetText('app.developerResetTitle')}</h3>
  <p>{translateResetText('app.developerResetDescription')}</p>
  <button ref={currentResetButton} class="danger" disabled={currentActionsDisabled||currentRequestBusy||!!currentPendingReset} onClick={()=>{setCurrentConfirmationText('');currentResetDialog.current?.showModal();}}>{translateResetText('app.developerResetTitle')}</button>
  <dialog ref={currentResetDialog} class="battle-confirm-dialog" aria-labelledby="developer-reset-title" onCancel={currentCancelEvent=>{currentCancelEvent.preventDefault();closeResetConfirmation();}}>
   <h2 id="developer-reset-title">{translateResetText('app.developerResetTitle')}</h2>
   <p>{translateResetText('app.developerResetDescription')}</p>
   <label>{translateResetText('app.developerResetConfirm')}<input value={currentConfirmationText} onInput={currentInputEvent=>setCurrentConfirmationText(currentInputEvent.currentTarget.value)}/></label>
   <button autoFocus class="secondary" onClick={closeResetConfirmation}>{translateResetText('app.developerCancel')}</button>
   <button class="danger" disabled={currentActionsDisabled||currentRequestBusy||currentConfirmationText!=='RESET test'} onClick={()=>{closeResetConfirmation();void submitCharacterReset();}}>{translateResetText('app.developerResetTitle')}</button>
  </dialog>
  {currentPendingReset&&!currentRequestBusy&&<><p role="status">{translateResetText('app.developerResetUncertain')}</p><button onClick={()=>void submitCharacterReset()}>{translateResetText('app.developerRetry')}</button></>}
  {currentNoticeMessage&&<p role="alert">{noticeText(currentNoticeMessage,currentDisplayLocale,translateResetText)}</p>}
 </section>;
}
