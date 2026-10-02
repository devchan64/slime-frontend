import {parseWorkshopCatalog,parseWorkshopQuote,parseWorkshopContracts} from '../src/client/workshop-validation.mjs';
import {parseEquipmentInventory} from '../src/client/equipment-validation.mjs';
const WORKSHOP_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
const WORKSHOP_CONTRACT_PATTERN=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const WORKSHOP_STATUS_LABELS={IN_PROGRESS:'작업 중',READY:'수령 가능',CLAIMED:'수령 완료'};
const WORKSHOP_COMMAND_HELP='workshop craft|repair|consumable catalog 시설ID [다음커서] / quote 시설ID 품목ID [소모품 수량] [재료ID=수량 ...] / create 시설ID / contracts 시설ID [다음커서] / claim 시설ID 계약ID';
function sanitizeWorkshopText(currentDisplayValue){return currentDisplayValue.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function captureWorkshopContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map?.id,currentGameState.me.position,currentGameState.me.version]);
}
function formatWorkshopQuote(currentQuoteRecord,currentContractKind){
 return currentContractKind==='repair'
  ?'내구도 '+currentQuoteRecord.before.currentDurability+'/'+currentQuoteRecord.before.maxDurability+' → '+currentQuoteRecord.after.currentDurability+'/'+currentQuoteRecord.after.maxDurability
  :sanitizeWorkshopText(currentQuoteRecord.definitionSnapshot.name)+(currentQuoteRecord.productionResult?' · Lv.'+currentQuoteRecord.productionResult.itemLevel:'')+' × '+(currentContractKind==='consumable'?currentQuoteRecord.quantity:1);
}
export async function executeWorkshopCommand(currentTextClient,currentCommandArguments){
 const [currentContractKind,currentActionName,currentFacilityIdentifier,...currentActionArguments]=currentCommandArguments;
 if(!['craft','repair','consumable'].includes(currentContractKind)||!['catalog','quote','create','contracts','claim'].includes(currentActionName)||!WORKSHOP_IDENTIFIER_PATTERN.test(currentFacilityIdentifier??'')
  ||(currentActionName==='catalog'&&currentActionArguments.length>(currentContractKind==='repair'?1:0))
  ||(currentActionName==='create'&&currentActionArguments.length!==0)
  ||(currentActionName==='quote'&&(currentContractKind==='craft'?(currentActionArguments.length<1||currentActionArguments.length>51):currentContractKind==='consumable'?(currentActionArguments.length<2||currentActionArguments.length>52):currentActionArguments.length!==1))
  ||(currentActionName==='contracts'&&currentActionArguments.length>1)
  ||(currentActionName==='claim'&&currentActionArguments.length!==1))throw new Error(WORKSHOP_COMMAND_HELP);
 const currentGameState=currentTextClient.state;
 const currentWorkshopEntry=currentGameState?.map?.buildings?.find(currentBuildingEntry=>currentBuildingEntry.facilityKind==='workshop'&&currentBuildingEntry.facilityId===currentFacilityIdentifier);
 if(!currentWorkshopEntry||currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation
  ||currentGameState.me.position?.column!==currentWorkshopEntry.entrance?.column||currentGameState.me.position?.row!==currentWorkshopEntry.entrance?.row)throw new Error('전투·조우를 종료하고 해당 공방 입구로 이동하세요.');
 const currentRequestPrefix='/v1/game/workshops/'+currentFacilityIdentifier;
 const currentQuoteContext=captureWorkshopContext(currentTextClient);
 const currentCommandPrefix='workshop '+currentContractKind;
 if(currentActionName==='catalog'){
  if(currentContractKind!=='repair')return parseWorkshopCatalog(await currentTextClient.request(currentRequestPrefix+'/catalog?kind='+currentContractKind)).map(currentItemEntry=>{
   const currentMaterialSlots=currentItemEntry.materialSlots??(currentItemEntry.materialSelection?[currentItemEntry.materialSelection]:[]);
   return sanitizeWorkshopText(currentItemEntry.name)+' ['+sanitizeWorkshopText(currentItemEntry.id)+']'+currentMaterialSlots.map(currentSlot=>' · 개당 필요 '+currentSlot.requiredQuantity+' · '+currentSlot.choices.map(currentChoice=>sanitizeWorkshopText(currentChoice.nameTranslations.ko)+' ['+sanitizeWorkshopText(currentChoice.materialId)+'] 보유 '+currentChoice.ownedQuantity).join(' / ')).join('');
  }).join('\n')||'제작 가능한 품목이 없습니다.';
  if(currentActionArguments.length&&!WORKSHOP_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error(WORKSHOP_COMMAND_HELP);
  const currentInventoryPage=parseEquipmentInventory(await currentTextClient.request('/v1/game/equipment'+(currentActionArguments.length?'?after='+currentActionArguments[0]:'')));
  return (currentInventoryPage.items.filter(currentItemEntry=>!currentItemEntry.equippedSlot&&!currentItemEntry.reserved&&currentItemEntry.maxDurability>1&&currentItemEntry.currentDurability<currentItemEntry.maxDurability)
   .map(currentItemEntry=>sanitizeWorkshopText(currentItemEntry.nameTranslations.ko)+' ['+currentItemEntry.instanceId+'] 내구도 '+currentItemEntry.currentDurability+'/'+currentItemEntry.maxDurability).join('\n')||'이 페이지에 수리 가능한 장비가 없습니다.')+(currentInventoryPage.nextCursor?'\n다음커서: '+currentInventoryPage.nextCursor:'');
 }
 if(currentActionName==='contracts'){
  if(currentActionArguments.length&&!WORKSHOP_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error(WORKSHOP_COMMAND_HELP);
  const currentContractPage=parseWorkshopContracts(await currentTextClient.request(currentRequestPrefix+'/contracts?kind='+currentContractKind+(currentActionArguments.length?'&after='+currentActionArguments[0]:'')),currentContractKind);
  return (currentContractPage.entries.map(currentContractEntry=>currentContractEntry.contractId+' · '+WORKSHOP_STATUS_LABELS[currentContractEntry.status]+' · '+formatWorkshopQuote(currentContractEntry.quote,currentContractKind)).join('\n')||'공방 계약이 없습니다.')+(currentContractPage.nextCursor?'\n다음커서: '+currentContractPage.nextCursor:'');
 }
 if(currentActionName==='quote'){
  currentTextClient.workshopPriceQuote=null;
  const [currentItemIdentifier,currentQuantityText]=currentActionArguments;
  if(!(currentContractKind==='repair'?WORKSHOP_CONTRACT_PATTERN:WORKSHOP_IDENTIFIER_PATTERN).test(currentItemIdentifier)
   ||(currentContractKind==='consumable'&&(!/^\d+$/.test(currentQuantityText)||!Number.isSafeInteger(Number(currentQuantityText))||Number(currentQuantityText)<1||Number(currentQuantityText)>1000)))throw new Error(WORKSHOP_COMMAND_HELP);
  let currentMaterialInputs;
  const currentMaterialOffset=currentContractKind==='consumable'?2:1;
  if(currentContractKind!=='repair'&&currentActionArguments.length>currentMaterialOffset){
   const currentSeenMaterials=new Set();
   currentMaterialInputs=currentActionArguments.slice(currentMaterialOffset).map(currentInputText=>{
    const currentInputMatch=/^([a-z][a-z0-9-]{0,99})=([1-9][0-9]*)$/.exec(currentInputText);
    if(!currentInputMatch||!Number.isSafeInteger(Number(currentInputMatch[2]))||Number(currentInputMatch[2])>10000||currentSeenMaterials.has(currentInputMatch[1]))throw new Error('재료ID=양의정수 형식으로 중복 없이 선택하세요.');
    currentSeenMaterials.add(currentInputMatch[1]);return {materialId:currentInputMatch[1],quantity:Number(currentInputMatch[2])};
   });
  }
  const currentQuoteSelection={targetId:currentItemIdentifier,...(currentMaterialInputs?{materialInputs:currentMaterialInputs}:{}),...(currentContractKind==='consumable'?{quantity:Number(currentQuantityText)}:{})};
  const currentQueryParameters=new URLSearchParams({kind:currentContractKind,targetId:currentItemIdentifier,...(currentContractKind==='consumable'?{quantity:currentQuantityText}:{})});
  const currentQuoteData=parseWorkshopQuote(await currentTextClient.request(currentMaterialInputs?currentRequestPrefix+'/production-quote':currentRequestPrefix+'/quote?'+currentQueryParameters,currentMaterialInputs?{...currentQuoteSelection,...(currentContractKind==='consumable'?{kind:currentContractKind}:{})}:undefined),currentContractKind,currentQuoteSelection);
  if(captureWorkshopContext(currentTextClient)!==currentQuoteContext||currentQuoteData.characterVersion!==currentGameState.me.version)throw new Error('상태 또는 견적 조건이 바뀌었습니다. 다시 조회하세요.');
  currentTextClient.workshopPriceQuote={kind:currentContractKind,context:currentQuoteContext,facilityId:currentFacilityIdentifier,targetId:currentItemIdentifier,materialInputs:currentMaterialInputs,data:currentQuoteData};
  return formatWorkshopQuote(currentQuoteData.quote,currentContractKind)+' · '+currentQuoteData.quote.costP+'P · '+currentQuoteData.quote.durationSeconds+'초\n'+currentQuoteData.materials.map(currentMaterialEntry=>sanitizeWorkshopText(currentMaterialEntry.nameTranslations.ko)+' 필요 '+currentMaterialEntry.quantity+' · 소비 '+(currentMaterialEntry.consumedQuantity??currentMaterialEntry.quantity)+' · 대체 구매 '+(currentMaterialEntry.missingQuantity??0)).join('\n')+'\n계약 후 취소 불가\n계약 확정: '+currentCommandPrefix+' create '+currentFacilityIdentifier;
 }
 if(currentActionName==='create'){
  const currentStoredQuote=currentTextClient.workshopPriceQuote;
  if(!currentStoredQuote||currentStoredQuote.kind!==currentContractKind||currentStoredQuote.context!==currentQuoteContext||currentStoredQuote.facilityId!==currentFacilityIdentifier)throw new Error('현재 상태에서 '+currentCommandPrefix+' quote로 견적을 먼저 확인하세요.');
  if(currentStoredQuote.data.ownedCoins!==undefined&&currentStoredQuote.data.ownedCoins<currentStoredQuote.data.quote.costP)throw new Error('작업 대금이 부족합니다.');
  currentTextClient.workshopPriceQuote=null;
  return currentTextClient.command(currentRequestPrefix+'/contracts',{kind:currentContractKind,targetId:currentStoredQuote.targetId,
   ...(currentStoredQuote.materialInputs?{materialInputs:currentStoredQuote.materialInputs}:{}),
   ...(currentContractKind==='consumable'?{quantity:currentStoredQuote.data.quote.quantity}:{}),
   ...(currentContractKind==='repair'?{expectedInstanceVersion:currentStoredQuote.data.quote.instanceVersion}:{}),quoteToken:currentStoredQuote.data.quoteToken});
 }
 if(!WORKSHOP_CONTRACT_PATTERN.test(currentActionArguments[0]))throw new Error(WORKSHOP_COMMAND_HELP);
 return currentTextClient.command(currentRequestPrefix+'/contracts/'+currentActionArguments[0]+'/claim',{kind:currentContractKind},undefined,{includeRequestIdentifier:false});
}
