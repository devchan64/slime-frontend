import {captureFacilitySessionContext,matchesFacilitySessionContext} from '../client/facilitySessionContext';
import {RefiningContractsPanel} from './RefiningContractsPanel';
import {useEffect,useRef,useState} from 'preact/hooks';
import {ApiError} from '../client/response';
import type {Client} from '../client/api';
import {parseEquipmentInventory} from '../client/equipment';
import {recoverWorkshopCreationResult,parseWorkshopCatalog,parseWorkshopContracts,parseWorkshopQuote,type WorkshopMaterialSelection,type WorkshopBatchSlot,type WorkshopContractKind,type WorkshopContractPage,type WorkshopQuoteResponse} from '../client/workshop';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';
import './workshop.css';

const WORKSHOP_REFRESH_MINIMUM_MS=1000;
const WORKSHOP_REFRESH_MAXIMUM_MS=2147483647;

type WorkshopSelectionOption={id:string;batchSlots?:WorkshopBatchSlot[];materialSelection?:WorkshopMaterialSelection;materialSlots?:(WorkshopMaterialSelection & {slotId:string})[];nameTranslations:{ko:string;en:string}};
export function WorkshopPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
  const {t:translateWorkshopText,locale:currentWorkshopLocale}=useTranslation();
  const [workshopPanelOpened,setWorkshopPanelOpened]=useState(false);
  const [currentContractKind,setCurrentContractKind]=useState<WorkshopContractKind>('craft');
  const [currentSelectionOptions,setCurrentSelectionOptions]=useState<WorkshopSelectionOption[]>([]);
  const [currentTargetIdentifier,setCurrentTargetIdentifier]=useState('');
  const [currentRequestedQuantity,setCurrentRequestedQuantity]=useState(1);
  const [currentBatchQuantities,setCurrentBatchQuantities]=useState<Record<string,number>>({});
  const [currentMaterialQuantities,setCurrentMaterialQuantities]=useState<Record<string,number>>({});
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
  const originalSessionReference=useRef(captureFacilitySessionContext(gameSessionClient));
  const workshopRequestBase=`/v1/game/workshops/${encodeURIComponent(currentFacilityIdentifier)}`;
  function workshopSessionMatches(){return activeWorkshopReference.current&&matchesFacilitySessionContext(gameSessionClient,originalSessionReference.current);}
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
        .map(currentCatalogItem=>({id:currentCatalogItem.id,materialSelection:currentCatalogItem.materialSelection,materialSlots:currentCatalogItem.materialSlots,batchSlots:currentCatalogItem.batchSlots,nameTranslations:{ko:currentCatalogItem.name,en:currentCatalogItem.englishName}}));
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
    setCurrentQuoteResponse(null);quotedRequestReference.current=null;
    const currentSelectedMaterials=(currentMaterialSlots.length?currentMaterialSlots.flatMap(currentMaterialSlot=>currentMaterialSlot.choices):undefined)?.map(currentMaterialChoice=>({materialId:currentMaterialChoice.materialId,quantity:currentMaterialQuantities[currentMaterialChoice.materialId]??0})).filter(currentMaterialEntry=>currentMaterialEntry.quantity>0);
    const currentSelectedBatches=currentBatchSlots.length?currentBatchSlots.flatMap(currentBatchSlot=>currentBatchSlot.choices).map(currentBatchChoice=>({batchId:currentBatchChoice.batchId,quantity:currentBatchQuantities[currentBatchChoice.batchId]??0})).filter(currentBatchInput=>currentBatchInput.quantity>0):undefined;
    if(!currentBatchSelectionValid)throw new Error(translateWorkshopText('workshop.batchRequired'));
    if(!currentMaterialSelectionValid)throw new Error(translateWorkshopText('workshop.materialTotalInvalid'));
    const currentRawQuote=await gameSessionClient.request(currentSelectedMaterials?`${workshopRequestBase}/production-quote`:`${workshopRequestBase}/quote?kind=${currentContractKind}&targetId=${encodeURIComponent(currentTargetIdentifier)}${(currentContractKind==='consumable'||currentContractKind==='material')?'&quantity='+currentRequestedQuantity:''}`,
      currentSelectedMaterials?{targetId:currentTargetIdentifier,materialInputs:currentSelectedMaterials,...(currentSelectedBatches?{batchInputs:currentSelectedBatches}:{}),...((currentContractKind==='consumable'||currentContractKind==='material')?{kind:currentContractKind,quantity:currentRequestedQuantity}:{})}:undefined);
    const receivedQuoteResponse=parseWorkshopQuote(currentRawQuote,currentContractKind,{targetId:currentTargetIdentifier,...(currentSelectedMaterials?{materialInputs:currentSelectedMaterials}:{}),...(currentSelectedBatches?{batchInputs:currentSelectedBatches}:{}),...((currentContractKind==='consumable'||currentContractKind==='material')?{quantity:currentRequestedQuantity}:{})});
    if(workshopSessionMatches()){setCurrentQuoteResponse(receivedQuoteResponse);quotedRequestReference.current={kind:currentContractKind,targetId:currentTargetIdentifier,
      ...(currentSelectedMaterials?{materialInputs:currentSelectedMaterials}:{}),...(currentSelectedBatches?{batchInputs:currentSelectedBatches}:{}),
      ...((currentContractKind==='consumable'||currentContractKind==='material')?{quantity:receivedQuoteResponse.quote.quantity}:{}),
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
  const currentSelectedOption=currentSelectionOptions.find(currentSelectionOption=>currentSelectionOption.id===currentTargetIdentifier);
  const currentMaterialSlots=currentContractKind==='repair'?[]:(currentSelectedOption?.materialSlots??(currentSelectedOption?.materialSelection?[currentSelectedOption.materialSelection]:[]));
  const currentQuantityMultiplier=(currentContractKind==='consumable'||currentContractKind==='material')?currentRequestedQuantity:1;
  const currentBatchSlots=['craft','consumable'].includes(currentContractKind)?(currentSelectedOption?.batchSlots??[]):[];
  const currentBatchSelectionValid=currentBatchSlots.every(currentBatchSlot=>currentBatchSlot.choices.reduce((currentTotalQuantity,currentBatchChoice)=>currentTotalQuantity+(currentBatchQuantities[currentBatchChoice.batchId]??0),0)===currentBatchSlot.requiredQuantity*currentQuantityMultiplier
    &&currentBatchSlot.choices.every(currentBatchChoice=>{const currentBatchQuantity=currentBatchQuantities[currentBatchChoice.batchId]??0;return Number.isSafeInteger(currentBatchQuantity)&&currentBatchQuantity>=0&&currentBatchQuantity<=currentBatchChoice.ownedQuantity;}));
  const currentMaterialSelectionValid=currentMaterialSlots.every(currentMaterialSlot=>{
    const currentRequiredQuantity=currentMaterialSlot.requiredQuantity*currentQuantityMultiplier;
    return currentMaterialSlot.choices.reduce((currentTotalValue,currentChoice)=>currentTotalValue+(currentMaterialQuantities[currentChoice.materialId]??0),0)===currentRequiredQuantity
      &&currentMaterialSlot.choices.every(currentChoice=>{const currentSelectedQuantity=currentMaterialQuantities[currentChoice.materialId]??0;return Number.isSafeInteger(currentSelectedQuantity)&&currentSelectedQuantity>=0&&currentSelectedQuantity<=currentRequiredQuantity&&(currentMaterialSlot.source!=='inventory_material'||currentSelectedQuantity<=currentChoice.ownedQuantity);});
  });
  const currentControlsDisabled=actionsAreDisabled||workshopRequestPending||workshopCreationUncertain;
  const currentQuoteBalanceInsufficient=currentQuoteResponse?.ownedCoins!==undefined
    &&currentQuoteResponse.ownedCoins<currentQuoteResponse.quote.costP;
  return <section class="workshop-panel">
    <button class="secondary compact" aria-expanded={workshopPanelOpened} disabled={currentControlsDisabled}
      onClick={()=>{setWorkshopPanelOpened(!workshopPanelOpened);if(!workshopPanelOpened)void loadWorkshopContents(currentContractKind);}}>{translateWorkshopText('workshop.title')}</button>
    {workshopPanelOpened&&<div>
      <p>{translateWorkshopText('workshop.citizenship')}</p>
      <div class="workshop-controls">{(['craft','consumable','material','repair'] as const).map(currentKindOption=><button class="secondary compact" aria-pressed={currentContractKind===currentKindOption}
        disabled={currentControlsDisabled} onClick={()=>void loadWorkshopContents(currentKindOption)}>{translateWorkshopText(`workshop.${currentKindOption}`)}</button>)}
        <button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void loadWorkshopContents(currentContractKind)}>{translateWorkshopText('journal.refresh')}</button></div>
      {currentWorkshopNotice&&<p role="alert">{noticeText(currentWorkshopNotice,currentWorkshopLocale,translateWorkshopText)}</p>}
      {workshopCreationUncertain&&<p role="status">{translateWorkshopText('workshop.uncertain')}</p>}
      {workshopRequestPending&&<p role="status">{translateWorkshopText('workshop.pending')}</p>}
      <label>{translateWorkshopText('workshop.item')}<select value={currentTargetIdentifier} disabled={currentControlsDisabled} onChange={currentSelectionEvent=>{
        setCurrentTargetIdentifier(currentSelectionEvent.currentTarget.value);setCurrentBatchQuantities({});
        const currentSelectedOption=currentSelectionOptions.find(currentSelectionOption=>currentSelectionOption.id===currentSelectionEvent.currentTarget.value);
        setCurrentMaterialQuantities(Object.fromEntries((currentSelectedOption?.materialSlots??(currentSelectedOption?.materialSelection?[currentSelectedOption.materialSelection]:[])).map(currentSlot=>[currentSlot.defaultMaterialId,currentSlot.requiredQuantity*((currentContractKind==='consumable'||currentContractKind==='material')?currentRequestedQuantity:1)])));setCurrentQuoteResponse(null);quotedRequestReference.current=null;}}>
        <option value="">{translateWorkshopText('workshop.choose')}</option>{currentSelectionOptions.map(currentSelectionOption=><option value={currentSelectionOption.id}>{currentSelectionOption.nameTranslations[currentWorkshopLocale]}</option>)}
      </select></label>
      {(currentContractKind==='consumable'||currentContractKind==='material')&&<label>{translateWorkshopText('workshop.quantity')}<input type="number" min="1" max="1000" step="1" value={currentRequestedQuantity} disabled={currentControlsDisabled}
        onInput={currentQuantityEvent=>{setCurrentRequestedQuantity(Number(currentQuantityEvent.currentTarget.value));setCurrentQuoteResponse(null);quotedRequestReference.current=null;}}/></label>}
      {currentMaterialSlots.map(currentMaterialSelection=><fieldset key={currentMaterialSelection.defaultMaterialId} disabled={currentControlsDisabled}>
        <legend>{translateWorkshopText('workshop.materialSelection')}</legend>
        {currentMaterialSelection.choices.map(currentMaterialChoice=><label key={currentMaterialChoice.materialId}>{currentMaterialChoice.nameTranslations[currentWorkshopLocale]} · {translateWorkshopText('workshop.materialOwned',{quantity:currentMaterialChoice.ownedQuantity})}
          <input type="number" min="0" max={currentMaterialSelection.requiredQuantity*currentQuantityMultiplier} step="1" value={currentMaterialQuantities[currentMaterialChoice.materialId]??0}
            onInput={currentInputEvent=>{setCurrentMaterialQuantities({...currentMaterialQuantities,[currentMaterialChoice.materialId]:Number(currentInputEvent.currentTarget.value)});setCurrentQuoteResponse(null);quotedRequestReference.current=null;}}/>
        </label>)}
        <p>{translateWorkshopText('workshop.materialTotal',{selected:currentMaterialSelection.choices.reduce((currentTotalValue,currentChoice)=>currentTotalValue+(currentMaterialQuantities[currentChoice.materialId]??0),0),required:currentMaterialSelection.requiredQuantity*currentQuantityMultiplier})}</p>
        {!currentMaterialSelectionValid&&<p>{translateWorkshopText('workshop.materialTotalInvalid')}</p>}
      </fieldset>)}
      {currentBatchSlots.map(currentBatchSlot=><fieldset key={currentBatchSlot.materialId} disabled={currentControlsDisabled}>
        <legend>{currentBatchSlot.nameTranslations[currentWorkshopLocale]} · {translateWorkshopText('workshop.batchSelection')}</legend>
        <p>{translateWorkshopText('workshop.batchRequired')}</p>
        {currentBatchSlot.choices.map(currentBatchChoice=><label key={currentBatchChoice.batchId}>Lv.{currentBatchChoice.itemLevel} · {currentBatchChoice.batchId} · {translateWorkshopText('workshop.materialOwned',{quantity:currentBatchChoice.ownedQuantity})}
          <input type="number" min="0" max={Math.min(currentBatchSlot.requiredQuantity*currentQuantityMultiplier,currentBatchChoice.ownedQuantity)} step="1" value={currentBatchQuantities[currentBatchChoice.batchId]??0}
            onInput={currentBatchEvent=>{setCurrentBatchQuantities({...currentBatchQuantities,[currentBatchChoice.batchId]:Number(currentBatchEvent.currentTarget.value)});setCurrentQuoteResponse(null);quotedRequestReference.current=null;}}/>
        </label>)}
        <p>{translateWorkshopText('workshop.materialTotal',{selected:currentBatchSlot.choices.reduce((currentTotalQuantity,currentBatchChoice)=>currentTotalQuantity+(currentBatchQuantities[currentBatchChoice.batchId]??0),0),required:currentBatchSlot.requiredQuantity*currentQuantityMultiplier})}</p>
      </fieldset>)}
      {!currentSelectionOptions.length&&<p>{translateWorkshopText('workshop.noItems')}</p>}
      <button class="secondary compact" disabled={currentControlsDisabled||!currentBatchSelectionValid||!currentMaterialSelectionValid||!currentTargetIdentifier||((currentContractKind==='consumable'||currentContractKind==='material')&&(!Number.isSafeInteger(currentRequestedQuantity)||currentRequestedQuantity<1||currentRequestedQuantity>1000))} onClick={()=>void requestWorkshopQuote()}>{translateWorkshopText('workshop.quote')}</button>
      {currentQuoteResponse&&<div class="workshop-quote">
        {currentQuoteResponse.quote.productionResult&&<p>Lv.{currentQuoteResponse.quote.productionResult.itemLevel}</p>}
        {currentQuoteResponse.quote.quantity!==undefined&&<p>{translateWorkshopText('workshop.quantityTime',{quantity:currentQuoteResponse.quote.quantity,seconds:currentQuoteResponse.quote.unitDurationSeconds!})}</p>}
        <p>{translateWorkshopText('workshop.price',{cost:currentQuoteResponse.quote.costP,seconds:currentQuoteResponse.quote.durationSeconds})}</p>
        {currentQuoteResponse.quote.baseCostP!==undefined&&<>
          <p>{translateWorkshopText('workshop.costBreakdown',{base:currentQuoteResponse.quote.baseCostP,missing:currentQuoteResponse.quote.missingMaterialCostP!})}</p>
          <small>{translateWorkshopText('workshop.substitutionRule')}</small>
        </>}
        {currentQuoteResponse.ownedCoins!==undefined&&<p>{translateWorkshopText('workshop.balance',{owned:currentQuoteResponse.ownedCoins,missing:Math.max(0,currentQuoteResponse.quote.costP-currentQuoteResponse.ownedCoins)})}</p>}
        {currentQuoteResponse.materials.map(currentMaterialRecord=><p>{currentMaterialRecord.nameTranslations[currentWorkshopLocale]} × {currentMaterialRecord.quantity}{currentMaterialRecord.ownedQuantity!==undefined&&<> · {currentMaterialRecord.missingQuantity!==undefined ? translateWorkshopText('workshop.materialAllocation',{owned:currentMaterialRecord.ownedQuantity,used:currentMaterialRecord.consumedQuantity!,missing:currentMaterialRecord.missingQuantity}) : translateWorkshopText('workshop.materialBalance',{owned:currentMaterialRecord.ownedQuantity,missing:Math.max(0,currentMaterialRecord.quantity-currentMaterialRecord.ownedQuantity)})}</>}</p>)}
        {currentQuoteResponse.quote.before&&currentQuoteResponse.quote.after&&<p>{translateWorkshopText('workshop.durability',{
          before:currentQuoteResponse.quote.before.currentDurability,beforeMax:currentQuoteResponse.quote.before.maxDurability,
          after:currentQuoteResponse.quote.after.currentDurability,afterMax:currentQuoteResponse.quote.after.maxDurability})}</p>}
        {currentQuoteResponse.quote.requestedBatches?.map(currentBatchInput=><p>{translateWorkshopText('workshop.batchSelection')} · {currentBatchInput.batchId} × {currentBatchInput.quantity}</p>)}
        <p>{translateWorkshopText('workshop.noCancel')}</p>
        <button class="compact" disabled={actionsAreDisabled||workshopRequestPending||(!workshopCreationUncertain&&currentQuoteBalanceInsufficient)} onClick={()=>void submitWorkshopContract()}>{translateWorkshopText('workshop.confirm')}</button>
    </div>}
      <h3>{translateWorkshopText('workshop.contracts')}</h3>
      {currentContractPage&&!currentContractPage.entries.length&&<p>{translateWorkshopText('workshop.empty')}</p>}
      <ul>{currentContractPage?.entries.map(currentContractEntry=><li key={currentContractEntry.contractId}>
        <strong>{currentContractEntry.quote.definitionSnapshot?.[currentWorkshopLocale==='ko'?'name':'englishName']??translateWorkshopText('workshop.repair')}{(currentContractEntry.kind==='consumable'||currentContractEntry.kind==='material')?' × '+currentContractEntry.quote.quantity:''}{currentContractEntry.quote.productionResult?' · Lv.'+currentContractEntry.quote.productionResult.itemLevel:''}</strong>
        <p>{translateWorkshopText(`workshop.${currentContractEntry.status.toLowerCase().replaceAll('_','')}`)}</p>
        <p>{translateWorkshopText('workshop.paidTotal',{cost:currentContractEntry.quote.costP})}</p>
        {currentContractEntry.quote.baseCostP!==undefined&&<small>{translateWorkshopText('workshop.costBreakdown',{
          base:currentContractEntry.quote.baseCostP,missing:currentContractEntry.quote.missingMaterialCostP!})}</small>}
        <small>{translateWorkshopText('workshop.readyAt',{time:new Date(currentContractEntry.readyAt*1000).toLocaleString(currentWorkshopLocale)})}</small>
        {currentContractEntry.status==='READY'&&<button class="compact" disabled={currentControlsDisabled} onClick={()=>void submitWorkshopContract(currentContractEntry.contractId)}>{translateWorkshopText('workshop.claim')}</button>}
      </li>)}</ul>
      {currentContractPage?.nextCursor&&<button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void loadWorkshopContents(currentContractKind,currentContractPage.nextCursor)}>{translateWorkshopText('workshop.next')}</button>}
      <RefiningContractsPanel key={`${currentFacilityIdentifier}:${gameSessionClient.state?.generation}`} gameSessionClient={gameSessionClient} currentFacilityIdentifier={currentFacilityIdentifier} actionsAreDisabled={currentControlsDisabled} />
    </div>}
  </section>;
}
