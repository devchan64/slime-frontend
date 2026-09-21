import {useEffect,useRef,useState} from 'preact/hooks';
import {ApiError} from '../client/response';
import type {Client} from '../client/api';
import {parseEquipmentInventory} from '../client/equipment';
import {recoverWorkshopCreationResult,parseWorkshopCatalog,parseWorkshopContracts,parseWorkshopQuote,type WorkshopContractKind,type WorkshopContractPage,type WorkshopQuoteResponse} from '../client/workshop';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';
import './workshop.css';

const WORKSHOP_REFRESH_MINIMUM_MS=1000;
const WORKSHOP_REFRESH_MAXIMUM_MS=2147483647;

type WorkshopSelectionOption={id:string;nameTranslations:{ko:string;en:string}};
export function WorkshopPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
  const {t:translateWorkshopText,locale:currentWorkshopLocale}=useTranslation();
  const [workshopPanelOpened,setWorkshopPanelOpened]=useState(false);
  const [currentContractKind,setCurrentContractKind]=useState<WorkshopContractKind>('craft');
  const [currentSelectionOptions,setCurrentSelectionOptions]=useState<WorkshopSelectionOption[]>([]);
  const [currentTargetIdentifier,setCurrentTargetIdentifier]=useState('');
  const [currentRequestedQuantity,setCurrentRequestedQuantity]=useState(1);
  const [currentQuoteResponse,setCurrentQuoteResponse]=useState<WorkshopQuoteResponse|null>(null);
  const [currentContractPage,setCurrentContractPage]=useState<WorkshopContractPage|null>(null);
  const [currentWorkshopNotice,setCurrentWorkshopNotice]=useState<Notice>('');
  const [workshopRequestPending,setWorkshopRequestPending]=useState(false);
  const [workshopCreationUncertain,setWorkshopCreationUncertain]=useState(false);
  const [currentContractCursor,setCurrentContractCursor]=useState<string|null>(null);
  const contractObservedAtReference=useRef(0);
  const attemptedRefreshKeyReference=useRef('');
  const activeWorkshopReference=useRef(false);
  const pendingWorkshopReference=useRef(false);
  const quotedRequestReference=useRef<Record<string,unknown>|null>(null);
  const originalSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
    character:gameSessionClient.state?.me.id,location:gameSessionClient.state?.location.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
  const workshopRequestBase=`/v1/game/workshops/${encodeURIComponent(currentFacilityIdentifier)}`;
  function workshopSessionMatches(){return activeWorkshopReference.current&&gameSessionClient.tokens?.user_id===originalSessionReference.current.owner
    &&gameSessionClient.state?.generation===originalSessionReference.current.generation&&gameSessionClient.state?.me.id===originalSessionReference.current.character
    &&gameSessionClient.state?.location.id===originalSessionReference.current.location&&gameSessionClient.state?.me.mode==='FIELD'
    &&JSON.stringify(gameSessionClient.state?.me.position)===originalSessionReference.current.position;}
  async function runWorkshopRequest(currentRequestAction:()=>Promise<void>){
    if(actionsAreDisabled||pendingWorkshopReference.current||!workshopSessionMatches())return;
    pendingWorkshopReference.current=true;setWorkshopRequestPending(true);setCurrentWorkshopNotice('');
    try{await currentRequestAction();}catch(currentRequestError){if(workshopSessionMatches())setCurrentWorkshopNotice(currentRequestError as Error);}
    finally{pendingWorkshopReference.current=false;if(workshopSessionMatches())setWorkshopRequestPending(false);}
  }
  async function loadWorkshopContents(currentRequestedKind:WorkshopContractKind,currentPageCursor:string|null=null){
    await runWorkshopRequest(async()=>{
      const receivedContractPage=parseWorkshopContracts(await gameSessionClient.request(`${workshopRequestBase}/contracts?kind=${currentRequestedKind}${currentPageCursor?'&after='+encodeURIComponent(currentPageCursor):''}`),currentRequestedKind);
      if(!workshopSessionMatches())return;
      let receivedSelectionOptions:WorkshopSelectionOption[]=[];
      if(currentRequestedKind!=='repair')receivedSelectionOptions=parseWorkshopCatalog(await gameSessionClient.request(`${workshopRequestBase}/catalog?kind=${currentRequestedKind}`))
        .map(currentCatalogItem=>({id:currentCatalogItem.id,nameTranslations:{ko:currentCatalogItem.name,en:currentCatalogItem.englishName}}));
      else{
        let currentInventoryCursor:string|null=null;
        const visitedInventoryCursors=new Set<string>();
        do{
          const receivedInventoryPage=parseEquipmentInventory(await gameSessionClient.request(`/v1/game/equipment${currentInventoryCursor?'?after='+encodeURIComponent(currentInventoryCursor):''}`));
          receivedSelectionOptions.push(...receivedInventoryPage.items.filter(currentEquipmentItem=>!currentEquipmentItem.equippedSlot&&!currentEquipmentItem.reserved
            &&currentEquipmentItem.maxDurability>1&&currentEquipmentItem.currentDurability<currentEquipmentItem.maxDurability)
            .map(currentEquipmentItem=>({id:currentEquipmentItem.instanceId,nameTranslations:currentEquipmentItem.nameTranslations})));
          currentInventoryCursor=receivedInventoryPage.nextCursor;
          if(currentInventoryCursor&&visitedInventoryCursors.has(currentInventoryCursor))throw new Error('장비 목록 페이지가 반복되었습니다.');
          if(currentInventoryCursor)visitedInventoryCursors.add(currentInventoryCursor);
        }while(currentInventoryCursor&&workshopSessionMatches());
      }
      if(workshopSessionMatches()){setCurrentContractKind(currentRequestedKind);setCurrentContractPage(receivedContractPage);contractObservedAtReference.current=performance.now();setCurrentContractCursor(currentPageCursor);attemptedRefreshKeyReference.current='';setCurrentSelectionOptions(receivedSelectionOptions);
        setCurrentTargetIdentifier('');setCurrentQuoteResponse(null);quotedRequestReference.current=null;}
    });
  }
  async function requestWorkshopQuote(){await runWorkshopRequest(async()=>{
    const receivedQuoteResponse=parseWorkshopQuote(await gameSessionClient.request(`${workshopRequestBase}/quote?kind=${currentContractKind}&targetId=${encodeURIComponent(currentTargetIdentifier)}${currentContractKind==='consumable'?'&quantity='+currentRequestedQuantity:''}`),currentContractKind);
    if(workshopSessionMatches()){setCurrentQuoteResponse(receivedQuoteResponse);quotedRequestReference.current={kind:currentContractKind,targetId:currentTargetIdentifier,
      ...(currentContractKind==='consumable'?{quantity:receivedQuoteResponse.quote.quantity}:{}),
      quoteToken:receivedQuoteResponse.quoteToken,expectedVersion:receivedQuoteResponse.characterVersion,requestId:crypto.randomUUID(),
      ...(currentContractKind==='repair'?{expectedInstanceVersion:receivedQuoteResponse.quote.instanceVersion}:{})};}
  });}
  async function submitWorkshopContract(currentContractIdentifier?:string){
    let currentActionSucceeded=false;
    await runWorkshopRequest(async()=>{
      if(!currentContractIdentifier&&!quotedRequestReference.current)return;
      if(!currentContractIdentifier&&workshopCreationUncertain&&await recoverWorkshopCreationResult(gameSessionClient,quotedRequestReference.current!,currentFacilityIdentifier)){
        if(!workshopSessionMatches())return;
        setWorkshopCreationUncertain(false);setCurrentQuoteResponse(null);quotedRequestReference.current=null;
        currentActionSucceeded=true;
        const currentRecoveredState=await gameSessionClient.request('/v1/game/state');
        if(workshopSessionMatches())gameSessionClient.accept(currentRecoveredState);
        return;
      }
      let currentCommandResponse;
      try{currentCommandResponse=await gameSessionClient.request(`${workshopRequestBase}/contracts${currentContractIdentifier?'/'+encodeURIComponent(currentContractIdentifier)+'/claim':''}`,
        currentContractIdentifier?{kind:currentContractKind,expectedVersion:gameSessionClient.state!.me.version}:quotedRequestReference.current!);}
      catch(currentCommandError){if(!currentContractIdentifier&&workshopSessionMatches())setWorkshopCreationUncertain(!(currentCommandError instanceof ApiError)||currentCommandError.status>=500);throw currentCommandError;}
      if(workshopSessionMatches()){gameSessionClient.accept(currentCommandResponse.state);currentActionSucceeded=true;setWorkshopCreationUncertain(false);setCurrentQuoteResponse(null);quotedRequestReference.current=null;}
    });
    if(currentActionSucceeded)await loadWorkshopContents(currentContractKind);
  }
  useEffect(()=>{activeWorkshopReference.current=true;return()=>{activeWorkshopReference.current=false;};},[]);
  useEffect(()=>{
    if(!workshopPanelOpened||!currentContractPage||actionsAreDisabled||workshopRequestPending||workshopCreationUncertain)return;
    const pendingContractTimes=currentContractPage.entries.filter(currentContractEntry=>currentContractEntry.status==='IN_PROGRESS')
      .map(currentContractEntry=>currentContractEntry.readyAt);
    if(!pendingContractTimes.length)return;
    const nextContractReadyAt=Math.min(...pendingContractTimes);
    const currentRefreshKey=`${currentContractKind}:${currentContractCursor}:${currentContractPage.serverTime}:${nextContractReadyAt}`;
    if(attemptedRefreshKeyReference.current===currentRefreshKey)return;
    const elapsedObservationTime=performance.now()-contractObservedAtReference.current;
    const remainingContractTime=(nextContractReadyAt-currentContractPage.serverTime)*1000-elapsedObservationTime;
    const currentRefreshTimer=window.setTimeout(()=>{
      if(!workshopSessionMatches()||pendingWorkshopReference.current)return;
      attemptedRefreshKeyReference.current=currentRefreshKey;
      void runWorkshopRequest(async()=>{
        const receivedContractPage=parseWorkshopContracts(await gameSessionClient.request(
          `${workshopRequestBase}/contracts?kind=${currentContractKind}${currentContractCursor?'&after='+encodeURIComponent(currentContractCursor):''}`),currentContractKind);
        if(workshopSessionMatches()){contractObservedAtReference.current=performance.now();setCurrentContractPage(receivedContractPage);}
      });
    },Math.min(WORKSHOP_REFRESH_MAXIMUM_MS,Math.max(WORKSHOP_REFRESH_MINIMUM_MS,remainingContractTime)));
    return()=>window.clearTimeout(currentRefreshTimer);
  },[workshopPanelOpened,currentContractPage,currentContractKind,currentContractCursor,actionsAreDisabled,workshopRequestPending,workshopCreationUncertain]);
  const currentControlsDisabled=actionsAreDisabled||workshopRequestPending||workshopCreationUncertain;
  return <section class="workshop-panel">
    <button class="secondary compact" aria-expanded={workshopPanelOpened} disabled={currentControlsDisabled}
      onClick={()=>{setWorkshopPanelOpened(!workshopPanelOpened);if(!workshopPanelOpened)void loadWorkshopContents(currentContractKind);}}>{translateWorkshopText('workshop.title')}</button>
    {workshopPanelOpened&&<div>
      <p>{translateWorkshopText('workshop.citizenship')}</p>
      <div class="workshop-controls">{(['craft','consumable','repair'] as const).map(currentKindOption=><button class="secondary compact" aria-pressed={currentContractKind===currentKindOption}
        disabled={currentControlsDisabled} onClick={()=>void loadWorkshopContents(currentKindOption)}>{translateWorkshopText(`workshop.${currentKindOption}`)}</button>)}
        <button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void loadWorkshopContents(currentContractKind)}>{translateWorkshopText('journal.refresh')}</button></div>
      {currentWorkshopNotice&&<p role="alert">{noticeText(currentWorkshopNotice,currentWorkshopLocale,translateWorkshopText)}</p>}
      {workshopCreationUncertain&&<p role="status">{translateWorkshopText('workshop.uncertain')}</p>}
      {workshopRequestPending&&<p role="status">{translateWorkshopText('workshop.pending')}</p>}
      <label>{translateWorkshopText('workshop.item')}<select value={currentTargetIdentifier} disabled={currentControlsDisabled} onChange={currentSelectionEvent=>{
        setCurrentTargetIdentifier(currentSelectionEvent.currentTarget.value);setCurrentQuoteResponse(null);quotedRequestReference.current=null;}}>
        <option value="">{translateWorkshopText('workshop.choose')}</option>{currentSelectionOptions.map(currentSelectionOption=><option value={currentSelectionOption.id}>{currentSelectionOption.nameTranslations[currentWorkshopLocale]}</option>)}
      </select></label>
      {currentContractKind==='consumable'&&<label>{translateWorkshopText('workshop.quantity')}<input type="number" min="1" max="1000" step="1" value={currentRequestedQuantity} disabled={currentControlsDisabled}
        onInput={currentQuantityEvent=>{setCurrentRequestedQuantity(Number(currentQuantityEvent.currentTarget.value));setCurrentQuoteResponse(null);quotedRequestReference.current=null;}}/></label>}
      {!currentSelectionOptions.length&&<p>{translateWorkshopText('workshop.noItems')}</p>}
      <button class="secondary compact" disabled={currentControlsDisabled||!currentTargetIdentifier||(currentContractKind==='consumable'&&(!Number.isSafeInteger(currentRequestedQuantity)||currentRequestedQuantity<1||currentRequestedQuantity>1000))} onClick={()=>void requestWorkshopQuote()}>{translateWorkshopText('workshop.quote')}</button>
      {currentQuoteResponse&&<div class="workshop-quote">
        {currentQuoteResponse.quote.quantity!==undefined&&<p>{translateWorkshopText('workshop.quantityTime',{quantity:currentQuoteResponse.quote.quantity,seconds:currentQuoteResponse.quote.unitDurationSeconds!})}</p>}
        <p>{translateWorkshopText('workshop.price',{cost:currentQuoteResponse.quote.costP,seconds:currentQuoteResponse.quote.durationSeconds})}</p>
        {currentQuoteResponse.materials.map(currentMaterialRecord=><p>{currentMaterialRecord.nameTranslations[currentWorkshopLocale]} × {currentMaterialRecord.quantity}</p>)}
        {currentQuoteResponse.quote.before&&currentQuoteResponse.quote.after&&<p>{translateWorkshopText('workshop.durability',{
          before:currentQuoteResponse.quote.before.currentDurability,beforeMax:currentQuoteResponse.quote.before.maxDurability,
          after:currentQuoteResponse.quote.after.currentDurability,afterMax:currentQuoteResponse.quote.after.maxDurability})}</p>}
        <p>{translateWorkshopText('workshop.noCancel')}</p>
        <button class="compact" disabled={actionsAreDisabled||workshopRequestPending} onClick={()=>void submitWorkshopContract()}>{translateWorkshopText('workshop.confirm')}</button>
      </div>}
      <h3>{translateWorkshopText('workshop.contracts')}</h3>
      {currentContractPage&&!currentContractPage.entries.length&&<p>{translateWorkshopText('workshop.empty')}</p>}
      <ul>{currentContractPage?.entries.map(currentContractEntry=><li key={currentContractEntry.contractId}>
        <strong>{currentContractEntry.quote.definitionSnapshot?.[currentWorkshopLocale==='ko'?'name':'englishName']??translateWorkshopText('workshop.repair')}{currentContractEntry.kind==='consumable'?' × '+currentContractEntry.quote.quantity:''}</strong>
        <p>{translateWorkshopText(`workshop.${currentContractEntry.status.toLowerCase().replaceAll('_','')}`)}</p>
        <small>{translateWorkshopText('workshop.readyAt',{time:new Date(currentContractEntry.readyAt*1000).toLocaleString(currentWorkshopLocale)})}</small>
        {currentContractEntry.status==='READY'&&<button class="compact" disabled={currentControlsDisabled} onClick={()=>void submitWorkshopContract(currentContractEntry.contractId)}>{translateWorkshopText('workshop.claim')}</button>}
      </li>)}</ul>
      {currentContractPage?.nextCursor&&<button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void loadWorkshopContents(currentContractKind,currentContractPage.nextCursor)}>{translateWorkshopText('workshop.next')}</button>}
    </div>}
  </section>;
}
