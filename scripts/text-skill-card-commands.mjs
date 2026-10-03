import {parseSkillCardInventory,validateSkillCardCommandResponse} from '../src/client/skill-card-validation.mjs';
const SKILL_CARD_IDENTIFIER_PATTERN=/^[a-z][a-z0-9-]{0,99}$/;
function sanitizeCardDisplayText(currentDisplayText){return currentDisplayText.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ');}
function captureCardRequestContext(currentTextClient){
 const currentGameState=currentTextClient.state;
 return JSON.stringify([currentTextClient.tokens?.user_id,currentGameState?.me.id,currentGameState?.generation,currentGameState?.epoch,
  currentGameState?.location?.id,currentGameState?.map?.id,currentGameState?.me.position,currentGameState?.me.version,currentGameState?.me.mode,currentGameState?.me.battleId]);
}
export async function executeSkillCardCommand(currentTextClient,currentCommandArguments){
 const [currentActionName,currentTargetIdentifier]=currentCommandArguments;
 if(!((currentActionName==='list'&&currentCommandArguments.length===1)
  ||(['shop','buy','use'].includes(currentActionName)&&currentCommandArguments.length===2&&SKILL_CARD_IDENTIFIER_PATTERN.test(currentTargetIdentifier))))
  throw new Error('cards list / cards shop 서점ID / cards buy 카드ID / cards use 카드ID로 입력하세요.');
 if(!currentTextClient.state||!currentTextClient.tokens?.user_id)throw new Error('먼저 로그인하고 캐릭터 상태를 조회하세요.');
 let currentRequestContext=captureCardRequestContext(currentTextClient);
 if(currentActionName==='list'||currentActionName==='shop'){
  currentTextClient.skillCardQuote=null;
  const currentRequestPath=currentActionName==='list'?'/v1/accounts/me/skill-cards':'/v1/game/bookshops/'+encodeURIComponent(currentTargetIdentifier)+'/skill-cards';
  const currentInventoryPage=parseSkillCardInventory(await currentTextClient.request(currentRequestPath));
  if(captureCardRequestContext(currentTextClient)!==currentRequestContext)throw new Error('캐릭터·세션·위치·상태가 변경되었습니다. 다시 조회하세요.');
  if(currentInventoryPage.characterVersion!==currentTextClient.state.me.version){
   const currentBeforeSnapshot=JSON.parse(currentRequestContext);
   await currentTextClient.snapshot();
   const currentAfterSnapshot=JSON.parse(captureCardRequestContext(currentTextClient));
   currentBeforeSnapshot[7]=currentAfterSnapshot[7];
   if(JSON.stringify(currentBeforeSnapshot)!==JSON.stringify(currentAfterSnapshot))throw new Error('상태 조회 중 세션·위치가 변경되었습니다. 카드 목록을 다시 확인하세요.');
   currentRequestContext=captureCardRequestContext(currentTextClient);
  }
  if(currentInventoryPage.characterVersion!==currentTextClient.state.me.version)throw new Error('상태가 변경되었습니다. 카드 목록을 다시 확인하세요.');
  if(currentActionName==='shop'&&!currentInventoryPage.catalog)throw new Error('서점 카드 목록이 누락되었습니다.');
  currentTextClient.skillCardQuote={context:currentRequestContext,facilityId:currentActionName==='shop'?currentTargetIdentifier:null,data:currentInventoryPage};
  if(currentActionName==='list')return currentInventoryPage.cards.length?currentInventoryPage.cards.map(currentCardEntry=>sanitizeCardDisplayText(
   `${currentCardEntry.nameTranslations.ko} [${currentCardEntry.cardId}] · 문해 요구 ${currentCardEntry.literacyRequired} / 현재 ${currentCardEntry.currentLiteracy} · 무기한 보관 · 사용 시 소모하고 스킬 레벨 0 습득`)).join('\n')+'\n사용 확정: cards use 카드ID':'보관 중인 스킬카드가 없습니다.';
  return currentInventoryPage.catalog.map(currentCardEntry=>sanitizeCardDisplayText(
   `${currentCardEntry.nameTranslations.ko} [${currentCardEntry.cardId}] · ${currentCardEntry.priceP} P · 사용 문해 ${currentCardEntry.literacyRequired} · ${currentCardEntry.learned?'이미 습득':currentCardEntry.owned?'보관 중':'구매 가능'}`)).join('\n')+'\n구매 확정: cards buy 카드ID';
 }
 const currentGameState=currentTextClient.state;
 if(currentGameState.me.mode!=='FIELD'||currentGameState.me.battleId||currentGameState.battle||currentGameState.reservation)throw new Error('전투·조우를 종료하고 필드에서 스킬카드를 이용하세요.');
 const currentSavedQuote=currentTextClient.skillCardQuote;
 if(!currentSavedQuote||currentSavedQuote.context!==currentRequestContext)throw new Error('cards shop 또는 cards list로 가격·사용 조건을 먼저 확인하세요.');
 const currentSelectedCard=(currentActionName==='buy'?currentSavedQuote.data.catalog:currentSavedQuote.data.cards)?.find(currentCardEntry=>currentCardEntry.cardId===currentTargetIdentifier);
 if(!currentSelectedCard||currentSelectedCard.learned)throw new Error('조회한 목록에서 미습득 스킬카드를 선택하세요.');
 if(currentActionName==='buy'&&(!currentSavedQuote.facilityId||currentSelectedCard.owned))throw new Error('서점 목록에서 보관 중이지 않은 카드를 선택하세요.');
 if(currentActionName==='use'&&currentSelectedCard.currentLiteracy<currentSelectedCard.literacyRequired)throw new Error('카드 사용에 필요한 문해 레벨이 부족합니다.');
 const currentCommandIdentity=currentActionName==='buy'?{kind:'purchase',cardId:currentTargetIdentifier,facilityId:currentSavedQuote.facilityId,definitionVersion:currentSelectedCard.definitionVersion,priceP:currentSelectedCard.priceP}:{kind:'use',cardId:currentTargetIdentifier};
 const currentCommandPath=currentActionName==='buy'?'/v1/game/bookshops/'+encodeURIComponent(currentSavedQuote.facilityId)+'/skill-card-purchases':'/v1/accounts/me/skill-cards/'+encodeURIComponent(currentTargetIdentifier)+'/use';
 const currentCommandPayload=currentActionName==='buy'?{cardId:currentTargetIdentifier,definitionVersion:currentSelectedCard.definitionVersion,priceP:currentSelectedCard.priceP}:{};
 currentTextClient.skillCardQuote=null;
 return currentTextClient.command(currentCommandPath,currentCommandPayload,()=>sanitizeCardDisplayText(
  `${currentSelectedCard.nameTranslations.ko} · ${currentActionName==='buy'?'구매 완료 · 계정 보관함 지급':'소모 완료 · 스킬 습득'}`),{
  includeRequestIdentifier:true,
  validateCommandResponse:(currentCommandResult,currentRequestBody)=>validateSkillCardCommandResponse(currentCommandResult,{
   characterId:currentGameState.me.id,generation:currentGameState.generation,expectedVersion:currentRequestBody.expectedVersion,requestId:currentRequestBody.requestId,
   command:currentCommandIdentity,grantsSkill:currentSelectedCard.grantsSkill,
  }),
 });
}
