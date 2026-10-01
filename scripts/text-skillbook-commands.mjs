import {parseSkillbookInventory} from '../src/client/skillbook-validation.mjs';
const SKILLBOOK_COMMAND_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
function sanitizeSkillbookDisplayText(currentDisplayText){return currentDisplayText.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function captureSkillbookRequestContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState?.me.id,currentGameState?.generation,currentGameState?.epoch,
  currentGameState?.location?.id,currentGameState?.map?.id,currentGameState?.me.position,currentGameState?.me.version,currentGameState?.me.mode,currentGameState?.me.battleId]);
}
export async function executeSkillbookCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentTargetIdentifier]=currentCommandArguments;
 if(!((currentActionName==='list'&&currentCommandArguments.length===1)
  ||(['shop','buy','read'].includes(currentActionName)&&currentCommandArguments.length===2&&SKILLBOOK_COMMAND_IDENTIFIER_PATTERN.test(currentTargetIdentifier))))
  throw new Error('books list / books shop 서점ID / books buy 스킬북ID / books read 스킬북ID로 입력하세요.');
 if(!currentTextClient.state||!currentTextClient.tokens?.user_id)throw new Error('먼저 로그인하고 캐릭터 상태를 조회하세요.');
 const currentGameState=currentTextClient.state;
 const currentRequestContext=captureSkillbookRequestContext(currentTextClient);
 if(currentActionName==='list'||currentActionName==='shop'){
  if(currentActionName==='shop')currentTextClient.bookshopCatalogQuote=null;
  const currentRequestPath=currentActionName==='list'?'/v1/game/skillbooks':'/v1/game/bookshops/'+encodeURIComponent(currentTargetIdentifier)+'/catalog';
  const currentInventoryPage=parseSkillbookInventory(await currentTextClient.request(currentRequestPath));
  if(captureSkillbookRequestContext(currentTextClient)!==currentRequestContext)throw new Error('캐릭터·세션·위치·상태가 변경되었습니다. 다시 조회하세요.');
  if(currentActionName==='list')return currentInventoryPage.books.length?currentInventoryPage.books.map(currentOwnedEntry=>
   sanitizeSkillbookDisplayText(`${currentOwnedEntry.nameTranslations.ko} [${currentOwnedEntry.definitionId}] · 문해 ${currentOwnedEntry.literacyRequired} · ${currentOwnedEntry.firstReadAt===null?'미열람':'열람 완료'}`)).join('\n'):'보유 스킬북이 없습니다.';
  if(!currentInventoryPage.catalog||currentInventoryPage.characterVersion!==currentGameState.me.version)throw new Error('현재 서점 목록을 확인할 수 없습니다. state 조회 후 books shop으로 다시 확인하세요.');
  currentTextClient.bookshopCatalogQuote={context:currentRequestContext,facilityId:currentTargetIdentifier,data:currentInventoryPage};
  return currentInventoryPage.catalog.map(currentBookEntry=>sanitizeSkillbookDisplayText(
   `${currentBookEntry.nameTranslations.ko} [${currentBookEntry.definitionId}] · ${currentBookEntry.priceP}p · 문해 ${currentBookEntry.literacyRequired} · ${currentBookEntry.owned?'보유 중':'구매 가능'}`)).join('\n')+'\n구매 확정: books buy 스킬북ID';
 }
 if(currentGameState.me.mode!=='FIELD'||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우를 종료하고 필드에서 스킬북을 이용하세요.');
 let currentPurchaseQuote=null;
 if(currentActionName==='buy'){
  const currentSavedCatalog=currentTextClient.bookshopCatalogQuote;
  if(!currentSavedCatalog||currentSavedCatalog.context!==currentRequestContext)throw new Error('현재 위치에서 books shop으로 가격을 먼저 확인하세요.');
  const currentSelectedBook=currentSavedCatalog.data.catalog.find(currentBookEntry=>currentBookEntry.definitionId===currentTargetIdentifier);
  if(!currentSelectedBook||currentSelectedBook.owned)throw new Error('서점 목록에 있는 미소유 스킬북을 선택하세요.');
  currentPurchaseQuote={facilityId:currentSavedCatalog.facilityId,definitionId:currentSelectedBook.definitionId,
   definitionVersion:currentSelectedBook.definitionVersion,priceP:currentSelectedBook.priceP};
  currentTextClient.bookshopCatalogQuote=null;
 }
 const currentCommandPath=currentPurchaseQuote?'/v1/game/bookshops/'+encodeURIComponent(currentPurchaseQuote.facilityId)+'/purchases':
  '/v1/game/skillbooks/'+encodeURIComponent(currentTargetIdentifier)+'/read';
 const currentCommandPayload=currentPurchaseQuote?{definitionId:currentPurchaseQuote.definitionId,definitionVersion:currentPurchaseQuote.definitionVersion,priceP:currentPurchaseQuote.priceP}:{};
 return currentTextClient.command(currentCommandPath,currentCommandPayload,currentCommandResult=>
  sanitizeSkillbookDisplayText(`스킬북 ${currentPurchaseQuote?'구매':'열람'} 완료 · ${currentCommandResult.book.nameTranslations.ko}`)+
   (currentPurchaseQuote?' · '+currentCommandResult.book.priceP+'p':''),{
  includeRequestIdentifier:!!currentPurchaseQuote,
  validateCommandResponse:(currentCommandResult,currentRequestBody)=>{
   const currentReturnedState=currentCommandResult?.state;
   if(currentReturnedState?.me?.id!==currentGameState.me.id||currentReturnedState.generation!==currentGameState.generation
    ||!Number.isSafeInteger(currentReturnedState.me.version)||currentReturnedState.me.version<currentRequestBody.expectedVersion)
    throw new Error('스킬북 응답의 캐릭터·세션·상태 버전이 다릅니다.');
   const currentReturnedBook=parseSkillbookInventory({characterVersion:currentReturnedState.me.version,books:[currentCommandResult.book]}).books[0];
   if(currentReturnedBook.definitionId!==currentTargetIdentifier)throw new Error('요청한 스킬북과 응답이 다릅니다.');
   if(currentPurchaseQuote){
    if(currentReturnedBook.requestId!==currentRequestBody.requestId||currentReturnedBook.facilityId!==currentPurchaseQuote.facilityId
     ||currentReturnedBook.definitionVersion!==currentRequestBody.definitionVersion||currentReturnedBook.priceP!==currentRequestBody.priceP)
     throw new Error('스킬북 구매 영수증이 요청과 다릅니다.');
   }else if(currentReturnedBook.firstReadAt===null)throw new Error('스킬북 열람 완료 기록이 없습니다.');
  },
 });
}
