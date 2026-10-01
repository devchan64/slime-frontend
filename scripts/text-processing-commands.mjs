import {parseRefiningCatalog,parseRefiningQuote,parseRefiningContracts} from '../src/client/refining-validation.mjs';

const PROCESSING_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const PROCESSING_CONTRACT_PATTERN=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PROCESSING_STATUS_LABELS={IN_PROGRESS:'가공 중',READY:'수령 가능',CLAIMED:'수령 완료'};
const PROCESSING_HELP_MESSAGE='processing catalog 시설ID / quote 시설ID 재료ID 등급 수량 / create 시설ID / contracts 시설ID [다음커서] / claim 시설ID 계약ID';
function sanitizeProcessingText(currentDisplayText){return currentDisplayText.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function captureProcessingContext(currentGameState){return JSON.stringify([currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map?.id,currentGameState.me.position?.column,currentGameState.me.position?.row,currentGameState.me.version]);}
function formatProcessingRecipe(currentRecipeEntry){
  const currentMethodLabel=currentRecipeEntry.processingMethod==='smelting'?'정련':currentRecipeEntry.processingMethod==='refining'?'정제':'가공';
  const currentKindLabel=currentRecipeEntry.outputMaterial.materialKind==='essence'?' · 속성 정수':currentRecipeEntry.outputMaterial.materialKind==='material'?' · 일반 가공재':'';
  return sanitizeProcessingText(`${currentRecipeEntry.collectionId ?? ''} / ${currentRecipeEntry.grade} → ${currentRecipeEntry.outputMaterial.name} × ${currentRecipeEntry.outputQuantity} | ${currentMethodLabel}${currentKindLabel} | 원재료 ${currentRecipeEntry.inputQuantity}개 · ${currentRecipeEntry.costP}p · ${currentRecipeEntry.durationSeconds}초`);
}
export async function executeProcessingCommand(currentTextClient,currentCommandArguments){
  const [currentActionName,currentFacilityIdentifier,...currentActionArguments]=currentCommandArguments;
  if(currentActionName==='facilities'&&currentCommandArguments.length===1){
    const currentBuildingEntries=currentTextClient.state?.map?.buildings;
    if(!Array.isArray(currentBuildingEntries))throw new Error('건물 목록이 없습니다. state로 최신 상태를 확인하세요.');
    return currentBuildingEntries.filter(currentBuildingEntry=>currentBuildingEntry.facilityKind==='workshop').map(currentBuildingEntry=>{
      if(typeof currentBuildingEntry.facilityId!=='string'||!PROCESSING_IDENTIFIER_PATTERN.test(currentBuildingEntry.facilityId)||typeof currentBuildingEntry.name!=='string'
        ||![currentBuildingEntry.entrance?.column,currentBuildingEntry.entrance?.row].every(currentCoordinateValue=>Number.isSafeInteger(currentCoordinateValue)&&currentCoordinateValue>=0))throw new Error('작업장 정보가 올바르지 않습니다.');
      return sanitizeProcessingText(currentBuildingEntry.name)+' ['+currentBuildingEntry.facilityId+'] 입구 ('+currentBuildingEntry.entrance.column+','+currentBuildingEntry.entrance.row+')';
    }).join('\n')||'현재 맵에 작업장이 없습니다.';
  }
  if(!['catalog','quote','create','contracts','claim'].includes(currentActionName)
    || typeof currentFacilityIdentifier!=='string' || !PROCESSING_IDENTIFIER_PATTERN.test(currentFacilityIdentifier)
    || (['catalog','create'].includes(currentActionName)&&currentActionArguments.length!==0)
    || (currentActionName==='quote'&&currentActionArguments.length!==3)
    || (currentActionName==='contracts'&&currentActionArguments.length>1)
    || (currentActionName==='claim'&&currentActionArguments.length!==1))throw new Error(PROCESSING_HELP_MESSAGE);
  const currentGameState=currentTextClient.state;
  if(currentGameState?.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우가 없는 필드에서 작업장을 이용하세요.');
  const currentRequestPrefix='/v1/game/workshops/'+encodeURIComponent(currentFacilityIdentifier)+'/refining-';
  const currentQuoteContext=captureProcessingContext(currentGameState);
  if(currentActionName==='catalog'){
    const currentCatalogData=parseRefiningCatalog(await currentTextClient.request(currentRequestPrefix+'catalog'));
    if(currentCatalogData.facilityId!==currentFacilityIdentifier)throw new Error('요청한 작업장과 목록이 일치하지 않습니다.');
    return currentCatalogData.available?currentCatalogData.entries.map(formatProcessingRecipe).join('\n')||'가공 목록이 없습니다.':'도시 규모가 지정되지 않아 가공할 수 없습니다.';
  }
  if(currentActionName==='contracts'){
    if(currentActionArguments.length&&!PROCESSING_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error('목록에 표시된 다음커서 UUID를 입력하세요.');
    const currentContractPage=parseRefiningContracts(await currentTextClient.request(currentRequestPrefix+'contracts'+(currentActionArguments.length?'?after='+encodeURIComponent(currentActionArguments[0]):'')));
    if(currentContractPage.entries.some(currentContractEntry=>currentContractEntry.facilityId!==currentFacilityIdentifier))throw new Error('요청한 작업장과 계약이 일치하지 않습니다.');
    return currentContractPage.entries.map(currentContractEntry=>sanitizeProcessingText(currentContractEntry.contractId)+' | '+PROCESSING_STATUS_LABELS[currentContractEntry.status]+' | '+formatProcessingRecipe(currentContractEntry.quote)).join('\n')+(currentContractPage.nextCursor?'\n다음커서: '+sanitizeProcessingText(currentContractPage.nextCursor):'')||'가공 계약이 없습니다.';
  }
  if(currentActionName==='quote'){
    currentTextClient.processingQuote=null;
    const [currentCollectionIdentifier,currentGradeValue,currentQuantityText]=currentActionArguments;
    if(!PROCESSING_IDENTIFIER_PATTERN.test(currentCollectionIdentifier)||!['low','medium','high'].includes(currentGradeValue)
      || !/^[0-9]+$/.test(currentQuantityText)||!Number.isSafeInteger(Number(currentQuantityText))||Number(currentQuantityText)<1||Number(currentQuantityText)>1000)throw new Error('재료 ID·등급(low/medium/high)·수량(1~1000)을 확인하세요.');
    const currentQueryParameters=new URLSearchParams({collectionId:currentCollectionIdentifier,grade:currentGradeValue,quantity:currentQuantityText});
    const currentQuoteData=parseRefiningQuote(await currentTextClient.request(currentRequestPrefix+'quote?'+currentQueryParameters));
    if(captureProcessingContext(currentTextClient.state)!==currentQuoteContext||currentQuoteData.characterVersion!==currentGameState.me.version
      ||currentQuoteData.quote.collectionId!==currentCollectionIdentifier||currentQuoteData.quote.grade!==currentGradeValue||currentQuoteData.quote.outputQuantity!==Number(currentQuantityText))throw new Error('상태 또는 견적 조건이 변경되었습니다. state 조회 후 다시 견적을 받으세요.');
    currentTextClient.processingQuote={facilityId:currentFacilityIdentifier,context:currentQuoteContext,data:currentQuoteData};
    return formatProcessingRecipe(currentQuoteData.quote)+`\n보유 원재료 ${currentQuoteData.quote.ownedQuantity}개 · 잔고 ${currentQuoteData.ownedCoins}p\n계약 확정: processing create ${currentFacilityIdentifier}`;
  }
  if(currentActionName==='create'){
    const currentStoredQuote=currentTextClient.processingQuote;
    if(!currentStoredQuote||currentStoredQuote.facilityId!==currentFacilityIdentifier||currentStoredQuote.context!==currentQuoteContext)throw new Error('현재 상태에서 processing quote로 견적을 먼저 확인하세요.');
    const currentQuoteData=currentStoredQuote.data;
    if(currentQuoteData.ownedCoins<currentQuoteData.quote.costP||currentQuoteData.quote.ownedQuantity<currentQuoteData.quote.inputQuantity)throw new Error('견적에 필요한 돈 또는 원재료가 부족합니다.');
    currentTextClient.processingQuote=null;
    return currentTextClient.command(currentRequestPrefix+'contracts',{collectionId:currentQuoteData.quote.collectionId,grade:currentQuoteData.quote.grade,quantity:currentQuoteData.quote.outputQuantity,quoteToken:currentQuoteData.quoteToken});
  }
  if(!PROCESSING_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error('목록에 표시된 계약 UUID를 입력하세요.');
  // 수령 API는 계약 ID 자체로 멱등 처리하며 requestId 필드를 받지 않는다.
  const currentClaimPath=currentRequestPrefix+'contracts/'+encodeURIComponent(currentActionArguments[0])+'/claim';
  return currentTextClient.command(currentClaimPath,{},undefined,{includeRequestIdentifier:false});
}
