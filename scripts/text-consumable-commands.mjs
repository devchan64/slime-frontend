import {parseWorkshopCatalog,parseWorkshopQuote,parseWorkshopContracts} from '../src/client/workshop-validation.mjs';
const CONSUMABLE_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const CONSUMABLE_CONTRACT_PATTERN=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CONSUMABLE_STATUS_LABELS={IN_PROGRESS:'제작 중',READY:'수령 가능',CLAIMED:'수령 완료'};
const CONSUMABLE_COMMAND_HELP='consumables catalog 시설ID / quote 시설ID 품목ID 수량 / create 시설ID / contracts 시설ID [다음커서] / claim 시설ID 계약ID';
function sanitizeConsumableText(currentDisplayValue){return currentDisplayValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function captureConsumableContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map?.id,currentGameState.me.position,currentGameState.me.version]);
}
export async function executeConsumableCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentFacilityIdentifier,...currentActionArguments]=currentCommandArguments;
 if(!['catalog','quote','create','contracts','claim'].includes(currentActionName)||!CONSUMABLE_IDENTIFIER_PATTERN.test(currentFacilityIdentifier??'')
  ||(['catalog','create'].includes(currentActionName)&&currentActionArguments.length!==0)
  ||(currentActionName==='quote'&&currentActionArguments.length!==2)
  ||(currentActionName==='contracts'&&currentActionArguments.length>1)
  ||(currentActionName==='claim'&&currentActionArguments.length!==1))throw new Error(CONSUMABLE_COMMAND_HELP);
 const currentGameState=currentTextClient.state;
 const currentWorkshopEntry=currentGameState?.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityKind==='workshop'&&currentBuildingEntry.facilityId===currentFacilityIdentifier);
 if(!currentWorkshopEntry||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation
  ||currentGameState.me.position?.column!==currentWorkshopEntry.entrance?.column||currentGameState.me.position?.row!==currentWorkshopEntry.entrance?.row)throw new Error('전투·조우를 종료하고 해당 공방 입구로 이동하세요.');
 const currentRequestPrefix='/v1/game/workshops/'+currentFacilityIdentifier;
 const currentQuoteContext=captureConsumableContext(currentTextClient);
 if(currentActionName==='catalog')return parseWorkshopCatalog(await currentTextClient.request(currentRequestPrefix+'/catalog?kind=consumable')).map(currentItemEntry=>sanitizeConsumableText(currentItemEntry.name)+' ['+sanitizeConsumableText(currentItemEntry.id)+']').join('\n')||'제작 가능한 소모품이 없습니다.';
 if(currentActionName==='contracts'){
  if(currentActionArguments.length&&!CONSUMABLE_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error(CONSUMABLE_COMMAND_HELP);
  const currentContractPage=parseWorkshopContracts(await currentTextClient.request(currentRequestPrefix+'/contracts?kind=consumable'+(currentActionArguments.length?'&after='+currentActionArguments[0]:'')),'consumable');
  return (currentContractPage.entries.map(currentContractEntry=>currentContractEntry.contractId+' · '+CONSUMABLE_STATUS_LABELS[currentContractEntry.status]+' · '+sanitizeConsumableText(currentContractEntry.quote.definitionSnapshot.name)+' × '+currentContractEntry.quote.quantity).join('\n')||'소모품 제작 계약이 없습니다.')+(currentContractPage.nextCursor?'\n다음커서: '+currentContractPage.nextCursor:'');
 }
 if(currentActionName==='quote'){
  currentTextClient.consumableCraftQuote=null;
  const [currentItemIdentifier,currentQuantityText]=currentActionArguments;
  if(!CONSUMABLE_IDENTIFIER_PATTERN.test(currentItemIdentifier)||!/^\d+$/.test(currentQuantityText)||!Number.isSafeInteger(Number(currentQuantityText))||Number(currentQuantityText)<1||Number(currentQuantityText)>1000)throw new Error(CONSUMABLE_COMMAND_HELP);
  const currentQuoteData=parseWorkshopQuote(await currentTextClient.request(currentRequestPrefix+'/quote?'+new URLSearchParams({kind:'consumable',targetId:currentItemIdentifier,quantity:currentQuantityText})),'consumable');
  if(captureConsumableContext(currentTextClient)!==currentQuoteContext||currentQuoteData.characterVersion!==currentGameState.me.version||currentQuoteData.quote.definitionId!==currentItemIdentifier||currentQuoteData.quote.quantity!==Number(currentQuantityText))throw new Error('상태 또는 견적 조건이 바뀌었습니다. 다시 조회하세요.');
  currentTextClient.consumableCraftQuote={context:currentQuoteContext,facilityId:currentFacilityIdentifier,targetId:currentItemIdentifier,data:currentQuoteData};
  return sanitizeConsumableText(currentQuoteData.quote.definitionSnapshot.name)+' × '+currentQuoteData.quote.quantity+' · '+currentQuoteData.quote.costP+'p · '+currentQuoteData.quote.durationSeconds+'초\n'+currentQuoteData.materials.map(currentMaterialEntry=>sanitizeConsumableText(currentMaterialEntry.nameTranslations.ko)+' 필요 '+currentMaterialEntry.quantity+' · 소비 '+(currentMaterialEntry.consumedQuantity??currentMaterialEntry.quantity)+' · 대체 구매 '+(currentMaterialEntry.missingQuantity??0)).join('\n')+'\n계약 확정: consumables create '+currentFacilityIdentifier;
 }
 if(currentActionName==='create'){
  const currentStoredQuote=currentTextClient.consumableCraftQuote;
  if(!currentStoredQuote||currentStoredQuote.context!==currentQuoteContext||currentStoredQuote.facilityId!==currentFacilityIdentifier)throw new Error('현재 상태에서 consumables quote로 견적을 먼저 확인하세요.');
  if(currentStoredQuote.data.ownedCoins!==undefined&&currentStoredQuote.data.ownedCoins<currentStoredQuote.data.quote.costP)throw new Error('제작 대금이 부족합니다.');
  currentTextClient.consumableCraftQuote=null;
  return currentTextClient.command(currentRequestPrefix+'/contracts',{kind:'consumable',targetId:currentStoredQuote.targetId,quantity:currentStoredQuote.data.quote.quantity,quoteToken:currentStoredQuote.data.quoteToken});
 }
 if(!CONSUMABLE_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error(CONSUMABLE_COMMAND_HELP);
 return currentTextClient.command(currentRequestPrefix+'/contracts/'+currentActionArguments[0]+'/claim',{kind:'consumable'},undefined,{includeRequestIdentifier:false});
}
