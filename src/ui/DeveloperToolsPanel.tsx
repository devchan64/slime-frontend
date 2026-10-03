import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

type DeveloperAssetName = 'CP'|'SP'|'P';
type DeveloperItemRecord = {category:string;itemId:string;quantity:number};
type DeveloperCatalogEntry = {category:string;itemId:string;nameTranslations:{ko:string;en:string};supportedOperations:('ADD'|'REMOVE')[]};
type DeveloperInventoryRecord = {characterId:string;version:number;items:DeveloperItemRecord[];balances:Record<DeveloperAssetName,number>};
type DeveloperAdjustmentPayload = {requestId:string;expectedVersion:number;operation:'ADD'|'REMOVE';asset:DeveloperAssetName|'ITEM';category?:string;itemId?:string;quantity:number};
type DeveloperReceiptRecord = {requestId:string;actorId:string;characterId:string;asset:DeveloperAssetName|'ITEM';category?:string;itemId?:string;operation:'ADD'|'REMOVE';quantity:number;before:number;after:number;version:number;createdAt:number;ok:boolean};
const DEVELOPER_ASSET_NAMES:DeveloperAssetName[]=['CP','SP','P'];

export function DeveloperToolsPanel({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}){
 const {t:translateDeveloperText,locale:currentDisplayLocale}=useTranslation();
 const [currentAccessAllowed,setCurrentAccessAllowed]=useState(false);
 const [currentPanelOpened,setCurrentPanelOpened]=useState(false);
 const [currentInventoryRecord,setCurrentInventoryRecord]=useState<DeveloperInventoryRecord|null>(null);
 const [currentHistoryEntries,setCurrentHistoryEntries]=useState<DeveloperReceiptRecord[]>([]);
 const [currentHistoryCursor,setCurrentHistoryCursor]=useState<string|null>(null);
 const [currentSelectedAsset,setCurrentSelectedAsset]=useState<DeveloperAssetName>('CP');
 const [currentCatalogEntries,setCurrentCatalogEntries]=useState<DeveloperCatalogEntry[]>([]);
 const [currentSelectedItem,setCurrentSelectedItem]=useState('');
 const [currentItemSearch,setCurrentItemSearch]=useState('');
 const [currentItemMode,setCurrentItemMode]=useState(false);
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
   ||!Array.isArray(currentInventory.items)||currentInventory.items.some((currentItemEntry:DeveloperItemRecord)=>typeof currentItemEntry.category!=='string'||typeof currentItemEntry.itemId!=='string'||!Number.isSafeInteger(currentItemEntry.quantity)||currentItemEntry.quantity<1)
   ||!DEVELOPER_ASSET_NAMES.every(currentAssetName=>Number.isSafeInteger(currentInventory.balances?.[currentAssetName])&&currentInventory.balances[currentAssetName]>=0))throw new Error(translateDeveloperText('app.developerInvalid'));
  const currentCatalog=await gameSessionClient.request('/v1/developer/catalog');
  if(!matchesCurrentDeveloperSession())return;
  if(currentCatalog.accountId!==currentOwnerContext.current.owner||currentCatalog.targetScope!=='SELF'||!Array.isArray(currentCatalog.entries)
   ||currentCatalog.entries.some((currentItemEntry:DeveloperCatalogEntry)=>typeof currentItemEntry.category!=='string'||typeof currentItemEntry.itemId!=='string'
    ||typeof currentItemEntry.nameTranslations?.ko!=='string'||typeof currentItemEntry.nameTranslations?.en!=='string'||!Array.isArray(currentItemEntry.supportedOperations)
    ||currentItemEntry.supportedOperations.some(currentOperationName=>!['ADD','REMOVE'].includes(currentOperationName))))throw new Error(translateDeveloperText('app.developerInvalid'));
  setCurrentCatalogEntries(currentCatalog.entries);
  const currentHistory=await gameSessionClient.request('/v1/developer/adjustments'+(currentNextCursor?'?after='+encodeURIComponent(currentNextCursor):''));
  if(!matchesCurrentDeveloperSession())return;
  if(currentHistory.characterId!==currentOwnerContext.current.character||!Array.isArray(currentHistory.entries)
   ||currentHistory.entries.some((currentEntry:DeveloperReceiptRecord)=>currentEntry.characterId!==currentOwnerContext.current.character||!(DEVELOPER_ASSET_NAMES as string[]).includes(currentEntry.asset)&&!(currentEntry.asset==='ITEM'&&typeof currentEntry.category==='string'&&typeof currentEntry.itemId==='string')
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
 const currentSelectedDefinition=currentCatalogEntries.find(currentItemEntry=>currentItemEntry.category+':'+currentItemEntry.itemId===currentSelectedItem);
 const currentItemSupported=!!currentSelectedDefinition?.supportedOperations.includes(currentOperationKind)
  &&(currentSelectedDefinition.category!=='skill_card'||currentQuantityValue===1);
 const currentSelectedLabel=currentItemMode&&currentSelectedDefinition?currentSelectedDefinition.nameTranslations[currentDisplayLocale]+' ('+currentSelectedDefinition.itemId+')':currentSelectedAsset;
 const currentBalanceValue=(currentItemMode?currentInventoryRecord?.items.find(currentItemEntry=>currentItemEntry.category+':'+currentItemEntry.itemId===currentSelectedItem)?.quantity:currentInventoryRecord?.balances[currentSelectedAsset])??0;
 const currentProjectedBalance=currentBalanceValue+(currentOperationKind==='ADD'?currentQuantityValue:-currentQuantityValue);
 const currentMutationBlocked=actionsAreDisabled||gameSessionClient.state?.me.mode!=='FIELD'||!!gameSessionClient.state?.battle||!!gameSessionClient.state?.reservation;
 async function submitDeveloperAdjustment(currentRetryRequested:boolean){
  if(!currentRetryRequested){
   if(currentMutationBlocked||currentPendingAdjustment.current||!currentInventoryRecord||!currentQuantityValid||currentProjectedBalance<0||(currentItemMode&&!currentItemSupported))return;
   if(!window.confirm(translateDeveloperText('app.developerConfirm',{asset:currentSelectedLabel,before:currentBalanceValue,after:currentProjectedBalance})))return;
   currentPendingAdjustment.current={payload:{requestId:crypto.randomUUID(),expectedVersion:currentInventoryRecord.version,operation:currentOperationKind,asset:currentItemMode?'ITEM':currentSelectedAsset,quantity:currentQuantityValue,...(currentItemMode?{category:currentSelectedDefinition!.category,itemId:currentSelectedDefinition!.itemId}:{})}};
  }
  const currentPendingRecord=currentPendingAdjustment.current;if(!currentPendingRecord)return;
  try{
   const currentReceipt:DeveloperReceiptRecord=currentPendingRecord.receipt??await gameSessionClient.request('/v1/developer/adjustments',currentPendingRecord.payload);
   if(!matchesCurrentDeveloperSession())return;
   const currentPayload=currentPendingRecord.payload;
   if(currentReceipt.ok!==true||currentReceipt.requestId!==currentPayload.requestId||currentReceipt.characterId!==currentOwnerContext.current.character
    ||currentReceipt.actorId!==currentOwnerContext.current.owner||currentReceipt.asset!==currentPayload.asset||currentReceipt.operation!==currentPayload.operation
    ||currentReceipt.category!==currentPayload.category||currentReceipt.itemId!==currentPayload.itemId
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
    <label><input type="checkbox" checked={currentItemMode} onChange={currentInputEvent=>setCurrentItemMode(currentInputEvent.currentTarget.checked)}/>{translateDeveloperText('app.developerItems')}</label>
    {currentItemMode?<><label>{translateDeveloperText('app.developerSearch')}<input value={currentItemSearch} onInput={currentInputEvent=>setCurrentItemSearch(currentInputEvent.currentTarget.value)}/></label>
     <label>{translateDeveloperText('app.developerAsset')}<select value={currentSelectedItem} onChange={currentInputEvent=>setCurrentSelectedItem(currentInputEvent.currentTarget.value)}>
      <option value="">{translateDeveloperText('app.developerSelectItem')}</option>
      {currentCatalogEntries.filter(currentItemEntry=>currentItemEntry.supportedOperations.length>0&&(currentItemEntry.category+':'+currentItemEntry.itemId===currentSelectedItem||(currentItemEntry.itemId+' '+currentItemEntry.nameTranslations[currentDisplayLocale]+' '+currentItemEntry.category).toLowerCase().includes(currentItemSearch.toLowerCase()))).map(currentItemEntry=><option value={currentItemEntry.category+':'+currentItemEntry.itemId}>{currentItemEntry.nameTranslations[currentDisplayLocale]} · {currentItemEntry.category} · {currentItemEntry.itemId}</option>)}
     </select></label></>:
    <label>{translateDeveloperText('app.developerAsset')}<select value={currentSelectedAsset} onChange={currentInputEvent=>setCurrentSelectedAsset(currentInputEvent.currentTarget.value as DeveloperAssetName)}>{DEVELOPER_ASSET_NAMES.map(currentAssetName=><option value={currentAssetName}>{currentAssetName}</option>)}</select></label>}
    <label>{translateDeveloperText('app.developerOperation')}<select value={currentOperationKind} onChange={currentInputEvent=>setCurrentOperationKind(currentInputEvent.currentTarget.value as 'ADD'|'REMOVE')}><option value="ADD">{translateDeveloperText('app.developerAdd')}</option><option value="REMOVE">{translateDeveloperText('app.developerRemove')}</option></select></label>
    {currentItemMode&&currentSelectedDefinition?.category==='skill_card'&&<p>{translateDeveloperText('app.developerCardQuantity')}</p>}
    <label>{translateDeveloperText('app.developerQuantity')}<input type="number" min="1" max="1000000000" step="1" value={currentQuantityInput} onInput={currentInputEvent=>setCurrentQuantityInput(currentInputEvent.currentTarget.value)}/></label>
    {currentInventoryRecord&&<p>{currentSelectedLabel}: {currentBalanceValue} → {currentQuantityValid?currentProjectedBalance:'—'}</p>}
    <button disabled={!currentInventoryRecord||!currentQuantityValid||currentProjectedBalance<0||(currentItemMode&&!currentItemSupported)} onClick={()=>void runDeveloperPanelAction(()=>submitDeveloperAdjustment(false))}>{translateDeveloperText('app.developerApply')}</button>
   </fieldset>
   {currentMutationBlocked&&<p>{translateDeveloperText('app.developerFieldOnly')}</p>}
   {currentRequestUncertain&&<><p role="status">{translateDeveloperText('app.developerUncertain')}</p><button disabled={currentRequestBusy} onClick={()=>void runDeveloperPanelAction(()=>submitDeveloperAdjustment(true))}>{translateDeveloperText('app.developerRetry')}</button></>}
   <h3>{translateDeveloperText('app.developerHistory')}</h3>
   <ul>{currentHistoryEntries.map(currentEntry=><li key={currentEntry.requestId}>{currentEntry.asset==='ITEM'?currentEntry.category+' '+currentEntry.itemId:currentEntry.asset}: {currentEntry.before} → {currentEntry.after} <small>{currentEntry.requestId}</small></li>)}</ul>
   {currentHistoryCursor&&<button disabled={currentRequestBusy||currentRequestUncertain} onClick={()=>void runDeveloperPanelAction(()=>loadDeveloperPanelData(currentHistoryCursor))}>{translateDeveloperText('app.developerNext')}</button>}
  </>}
  {currentNoticeMessage&&<p role="status">{noticeText(currentNoticeMessage,currentDisplayLocale,translateDeveloperText)}</p>}
 </section>;
}
