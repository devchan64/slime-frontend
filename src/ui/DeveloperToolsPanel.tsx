import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

type DeveloperAssetName = 'CP'|'SP'|'P';
type DeveloperInventoryRecord = {characterId:string;version:number;balances:Record<DeveloperAssetName,number>};
type DeveloperAdjustmentPayload = {requestId:string;expectedVersion:number;operation:'ADD'|'REMOVE';asset:DeveloperAssetName;quantity:number};
type DeveloperReceiptRecord = {requestId:string;actorId:string;characterId:string;asset:DeveloperAssetName;operation:'ADD'|'REMOVE';quantity:number;before:number;after:number;version:number;createdAt:number;ok:boolean};
const DEVELOPER_ASSET_NAMES:DeveloperAssetName[]=['CP','SP','P'];

export function DeveloperToolsPanel({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}){
 const {t:translateDeveloperText,locale:currentDisplayLocale}=useTranslation();
 const [currentAccessAllowed,setCurrentAccessAllowed]=useState(false);
 const [currentPanelOpened,setCurrentPanelOpened]=useState(false);
 const [currentInventoryRecord,setCurrentInventoryRecord]=useState<DeveloperInventoryRecord|null>(null);
 const [currentHistoryEntries,setCurrentHistoryEntries]=useState<DeveloperReceiptRecord[]>([]);
 const [currentHistoryCursor,setCurrentHistoryCursor]=useState<string|null>(null);
 const [currentSelectedAsset,setCurrentSelectedAsset]=useState<DeveloperAssetName>('CP');
 const [currentQuantityInput,setCurrentQuantityInput]=useState('1');
 const [currentOperationKind,setCurrentOperationKind]=useState<'ADD'|'REMOVE'>('ADD');
 const [currentRequestBusy,setCurrentRequestBusy]=useState(false);
 const [currentRequestUncertain,setCurrentRequestUncertain]=useState(false);
 const [currentNoticeMessage,setCurrentNoticeMessage]=useState<Notice>('');
 const currentActiveReference=useRef(false);
 const currentBusyReference=useRef(false);
 const currentPendingAdjustment=useRef<{payload:DeveloperAdjustmentPayload;receipt?:DeveloperReceiptRecord}|null>(null);
 const currentOwnerContext=useRef({owner:gameSessionClient.tokens?.user_id,character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation});
 const matchesCurrentDeveloperSession=()=>currentActiveReference.current&&gameSessionClient.tokens?.user_id===currentOwnerContext.current.owner
  &&gameSessionClient.state?.me.id===currentOwnerContext.current.character&&gameSessionClient.state?.generation===currentOwnerContext.current.generation;
 async function loadDeveloperPanelData(currentNextCursor?:string){
  const currentInventory=await gameSessionClient.request('/v1/developer/inventory');
  if(!matchesCurrentDeveloperSession())return;
  if(currentInventory.characterId!==currentOwnerContext.current.character||!Number.isSafeInteger(currentInventory.version)
   ||!DEVELOPER_ASSET_NAMES.every(currentAssetName=>Number.isSafeInteger(currentInventory.balances?.[currentAssetName])&&currentInventory.balances[currentAssetName]>=0))throw new Error(translateDeveloperText('app.developerInvalid'));
  const currentHistory=await gameSessionClient.request('/v1/developer/adjustments'+(currentNextCursor?'?after='+encodeURIComponent(currentNextCursor):''));
  if(!matchesCurrentDeveloperSession())return;
  if(currentHistory.characterId!==currentOwnerContext.current.character||!Array.isArray(currentHistory.entries)
   ||currentHistory.entries.some((currentEntry:DeveloperReceiptRecord)=>currentEntry.characterId!==currentOwnerContext.current.character||!DEVELOPER_ASSET_NAMES.includes(currentEntry.asset)
    ||!Number.isSafeInteger(currentEntry.before)||!Number.isSafeInteger(currentEntry.after)||typeof currentEntry.requestId!=='string')
   ||(currentHistory.nextCursor!==null&&typeof currentHistory.nextCursor!=='string'))throw new Error(translateDeveloperText('app.developerInvalid'));
  setCurrentInventoryRecord(currentInventory);setCurrentHistoryEntries(currentHistory.entries);setCurrentHistoryCursor(currentHistory.nextCursor);
 }
 async function runDeveloperPanelAction(currentPanelAction:()=>Promise<void>){
  if(currentBusyReference.current||!matchesCurrentDeveloperSession())return;
  currentBusyReference.current=true;setCurrentRequestBusy(true);setCurrentNoticeMessage('');
  try{await currentPanelAction();}catch(currentActionError){if(matchesCurrentDeveloperSession())setCurrentNoticeMessage(currentActionError as Error);}
  finally{currentBusyReference.current=false;if(matchesCurrentDeveloperSession())setCurrentRequestBusy(false);}
 }
 useEffect(()=>{
  currentActiveReference.current=true;
  void gameSessionClient.request('/v1/developer/capabilities').then(currentCapabilities=>{
   if(matchesCurrentDeveloperSession()&&currentCapabilities.accountId===currentOwnerContext.current.owner&&currentCapabilities.targetScope==='SELF')setCurrentAccessAllowed(true);
  }).catch(currentAccessError=>{if(matchesCurrentDeveloperSession()&&(!(currentAccessError instanceof ApiError)||currentAccessError.status!==403))setCurrentNoticeMessage(currentAccessError as Error);});
  return()=>{currentActiveReference.current=false;};
 },[]);
 const currentQuantityValue=Number(currentQuantityInput);
 const currentQuantityValid=/^[1-9][0-9]*$/.test(currentQuantityInput)&&Number.isSafeInteger(currentQuantityValue)&&currentQuantityValue<=1000000000;
 const currentBalanceValue=currentInventoryRecord?.balances[currentSelectedAsset]??0;
 const currentProjectedBalance=currentBalanceValue+(currentOperationKind==='ADD'?currentQuantityValue:-currentQuantityValue);
 const currentMutationBlocked=actionsAreDisabled||gameSessionClient.state?.me.mode!=='FIELD'||!!gameSessionClient.state?.battle||!!gameSessionClient.state?.reservation;
 async function submitDeveloperAdjustment(currentRetryRequested:boolean){
  if(!currentRetryRequested){
   if(currentMutationBlocked||currentPendingAdjustment.current||!currentInventoryRecord||!currentQuantityValid||currentProjectedBalance<0)return;
   if(!window.confirm(translateDeveloperText('app.developerConfirm',{asset:currentSelectedAsset,before:currentBalanceValue,after:currentProjectedBalance})))return;
   currentPendingAdjustment.current={payload:{requestId:crypto.randomUUID(),expectedVersion:currentInventoryRecord.version,operation:currentOperationKind,asset:currentSelectedAsset,quantity:currentQuantityValue}};
  }
  const currentPendingRecord=currentPendingAdjustment.current;if(!currentPendingRecord)return;
  try{
   const currentReceipt:DeveloperReceiptRecord=currentPendingRecord.receipt??await gameSessionClient.request('/v1/developer/adjustments',currentPendingRecord.payload);
   if(!matchesCurrentDeveloperSession())return;
   const currentPayload=currentPendingRecord.payload;
   if(currentReceipt.ok!==true||currentReceipt.requestId!==currentPayload.requestId||currentReceipt.characterId!==currentOwnerContext.current.character
    ||currentReceipt.actorId!==currentOwnerContext.current.owner||currentReceipt.asset!==currentPayload.asset||currentReceipt.operation!==currentPayload.operation
    ||currentReceipt.quantity!==currentPayload.quantity||currentReceipt.version!==currentPayload.expectedVersion+1
    ||![currentReceipt.before,currentReceipt.after].every(currentBalance=>Number.isSafeInteger(currentBalance)&&currentBalance>=0)
    ||currentReceipt.after-currentReceipt.before!==currentPayload.quantity*(currentPayload.operation==='ADD'?1:-1))throw new Error(translateDeveloperText('app.developerInvalid'));
   currentPendingRecord.receipt=currentReceipt;
   const currentLatestState=await gameSessionClient.request('/v1/game/state');
   if(!matchesCurrentDeveloperSession())return;
   if(currentLatestState.me?.id!==currentOwnerContext.current.character||currentLatestState.generation!==currentOwnerContext.current.generation||currentLatestState.me.version<currentReceipt.version)throw new Error(translateDeveloperText('app.developerInvalid'));
   gameSessionClient.accept(currentLatestState);
   currentPendingAdjustment.current=null;setCurrentRequestUncertain(false);
   await loadDeveloperPanelData();setCurrentNoticeMessage({key:'app.developerCompleted'});
  }catch(currentCommandError){
   if(matchesCurrentDeveloperSession()){
    const currentOutcomeUncertain=!!currentPendingRecord.receipt||!(currentCommandError instanceof ApiError)||currentCommandError.status>=500;
    setCurrentRequestUncertain(currentOutcomeUncertain&&currentPendingAdjustment.current!==null);
    if(!currentOutcomeUncertain){currentPendingAdjustment.current=null;setCurrentInventoryRecord(null);}
   }
   throw currentCommandError;
  }
 }
 if(!currentAccessAllowed)return currentNoticeMessage?<p role="status">{noticeText(currentNoticeMessage,currentDisplayLocale,translateDeveloperText)}</p>:null;
 return <section class="card" aria-label={translateDeveloperText('app.developerTitle')}>
  <button class="secondary" aria-expanded={currentPanelOpened} disabled={currentRequestBusy||currentRequestUncertain} onClick={()=>{
   setCurrentPanelOpened(!currentPanelOpened);if(!currentPanelOpened)void runDeveloperPanelAction(()=>loadDeveloperPanelData());
  }}>{translateDeveloperText('app.developerTitle')}</button>
  {currentPanelOpened&&<><p>{translateDeveloperText('app.developerSelf')}</p>
   <button class="secondary" disabled={currentRequestBusy||currentRequestUncertain} onClick={()=>void runDeveloperPanelAction(()=>loadDeveloperPanelData())}>{translateDeveloperText('app.developerRefresh')}</button>
   <fieldset disabled={currentRequestBusy||currentRequestUncertain||currentMutationBlocked}>
    <legend>{translateDeveloperText('app.developerBalance')}</legend>
    <label>{translateDeveloperText('app.developerAsset')}<select value={currentSelectedAsset} onChange={currentInputEvent=>setCurrentSelectedAsset(currentInputEvent.currentTarget.value as DeveloperAssetName)}>{DEVELOPER_ASSET_NAMES.map(currentAssetName=><option value={currentAssetName}>{currentAssetName}</option>)}</select></label>
    <label>{translateDeveloperText('app.developerOperation')}<select value={currentOperationKind} onChange={currentInputEvent=>setCurrentOperationKind(currentInputEvent.currentTarget.value as 'ADD'|'REMOVE')}><option value="ADD">{translateDeveloperText('app.developerAdd')}</option><option value="REMOVE">{translateDeveloperText('app.developerRemove')}</option></select></label>
    <label>{translateDeveloperText('app.developerQuantity')}<input type="number" min="1" max="1000000000" step="1" value={currentQuantityInput} onInput={currentInputEvent=>setCurrentQuantityInput(currentInputEvent.currentTarget.value)}/></label>
    {currentInventoryRecord&&<p>{currentSelectedAsset}: {currentBalanceValue} → {currentQuantityValid?currentProjectedBalance:'—'}</p>}
    <button disabled={!currentInventoryRecord||!currentQuantityValid||currentProjectedBalance<0} onClick={()=>void runDeveloperPanelAction(()=>submitDeveloperAdjustment(false))}>{translateDeveloperText('app.developerApply')}</button>
   </fieldset>
   {currentMutationBlocked&&<p>{translateDeveloperText('app.developerFieldOnly')}</p>}
   {currentRequestUncertain&&<><p role="status">{translateDeveloperText('app.developerUncertain')}</p><button disabled={currentRequestBusy} onClick={()=>void runDeveloperPanelAction(()=>submitDeveloperAdjustment(true))}>{translateDeveloperText('app.developerRetry')}</button></>}
   <h3>{translateDeveloperText('app.developerHistory')}</h3>
   <ul>{currentHistoryEntries.map(currentEntry=><li key={currentEntry.requestId}>{currentEntry.asset}: {currentEntry.before} → {currentEntry.after} <small>{currentEntry.requestId}</small></li>)}</ul>
   {currentHistoryCursor&&<button disabled={currentRequestBusy||currentRequestUncertain} onClick={()=>void runDeveloperPanelAction(()=>loadDeveloperPanelData(currentHistoryCursor))}>{translateDeveloperText('app.developerNext')}</button>}
  </>}
  {currentNoticeMessage&&<p role="status">{noticeText(currentNoticeMessage,currentDisplayLocale,translateDeveloperText)}</p>}
 </section>;
}
