import {parseGuildMaterialCatalog,parseGuildMaterialQuote} from '../src/client/guild-trade-validation.mjs';
const GUILD_SALE_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
function captureGuildSaleContext(currentGameState){return JSON.stringify([currentGameState.me.id,currentGameState.generation,currentGameState.epoch,currentGameState.location?.id,currentGameState.map?.id,currentGameState.me.position,currentGameState.me.version]);}
export async function executeGuildSaleCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentFacilityIdentifier,...currentSaleArguments]=currentCommandArguments;
 if(!['list','quote','sell'].includes(currentActionName)||typeof currentFacilityIdentifier!=='string'||!GUILD_SALE_IDENTIFIER_PATTERN.test(currentFacilityIdentifier)
  ||currentSaleArguments.length!==(currentActionName==='quote'?2:0))throw new Error('materials list 길드ID / materials quote 길드ID 재료ID 수량 / materials sell 길드ID로 입력하세요.');
 const currentGameState=currentTextClient.state;
 if(currentGameState?.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우를 종료하고 길드에서 재료를 판매하세요.');
 const currentRequestBase='/v1/game/guilds/'+encodeURIComponent(currentFacilityIdentifier);
 const currentSaleContext=captureGuildSaleContext(currentGameState);
 if(currentActionName==='list'){
  const currentCatalogData=parseGuildMaterialCatalog(await currentTextClient.request(currentRequestBase+'/materials'));
  return currentCatalogData.items.map(currentMaterialEntry=>`${currentMaterialEntry.nameTranslations.ko} [${currentMaterialEntry.materialId}] × ${currentMaterialEntry.quantity} · 개당 ${currentMaterialEntry.unitPriceP}p`.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ')).join('\n')+'\n회당 판매 상한: '+currentCatalogData.maximumQuantity+'개';
 }
 if(currentActionName==='quote'){
  currentTextClient.guildSaleQuote=null;
  const [currentMaterialIdentifier,currentQuantityText]=currentSaleArguments;
  if(!GUILD_SALE_IDENTIFIER_PATTERN.test(currentMaterialIdentifier)||!/^\d+$/.test(currentQuantityText)||!Number.isSafeInteger(Number(currentQuantityText))||Number(currentQuantityText)<1)throw new Error('재료 ID와 양의 정수 수량을 입력하세요.');
  const currentQuoteQuery=new URLSearchParams({materialId:currentMaterialIdentifier,quantity:currentQuantityText});
  const currentQuoteData=parseGuildMaterialQuote(await currentTextClient.request(currentRequestBase+'/material-quote?'+currentQuoteQuery),currentMaterialIdentifier,Number(currentQuantityText));
  if(captureGuildSaleContext(currentTextClient.state)!==currentSaleContext||currentQuoteData.characterVersion!==currentGameState.me.version)throw new Error('상태가 변경되었습니다. state 조회 후 견적을 다시 확인하세요.');
  currentTextClient.guildSaleQuote={context:currentSaleContext,facilityId:currentFacilityIdentifier,data:currentQuoteData};
  return `${currentMaterialIdentifier} × ${currentQuoteData.quantity} 판매 · 개당 ${currentQuoteData.unitPriceP}p · 수령 ${currentQuoteData.totalPriceP}p\n판매 확정: materials sell ${currentFacilityIdentifier}`;
 }
 const currentSavedQuote=currentTextClient.guildSaleQuote;
 if(!currentSavedQuote||currentSavedQuote.context!==currentSaleContext||currentSavedQuote.facilityId!==currentFacilityIdentifier)throw new Error('현재 상태에서 materials quote로 판매 견적을 먼저 확인하세요.');
 currentTextClient.guildSaleQuote=null;
 const currentQuoteData=currentSavedQuote.data;
 return currentTextClient.command(currentRequestBase+'/material-sales',{materialId:currentQuoteData.materialId,quantity:currentQuoteData.quantity,policyVersion:currentQuoteData.policyVersion,unitPriceP:currentQuoteData.unitPriceP});
}
