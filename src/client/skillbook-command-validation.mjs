import {parseSkillbookInventory} from './skillbook-validation.mjs';
export function validateSkillbookCommandResponse(currentCommandResult,currentExpectedCommand){
 const currentReturnedState=currentCommandResult?.state;
 if(currentReturnedState?.protocolVersion!==1||currentReturnedState?.me?.id!==currentExpectedCommand.characterId
  ||currentReturnedState.generation!==currentExpectedCommand.generation
  ||!['epoch','cursor'].every(currentFieldName=>Number.isSafeInteger(currentReturnedState[currentFieldName])&&currentReturnedState[currentFieldName]>=0)
  ||!Number.isSafeInteger(currentReturnedState.me.version)||currentReturnedState.me.version<currentExpectedCommand.expectedVersion)
  throw new Error('스킬북 응답의 캐릭터·세션·상태 버전이 다릅니다.');
 const currentReturnedBook=parseSkillbookInventory({characterVersion:currentReturnedState.me.version,books:[currentCommandResult.book]}).books[0];
 if(currentReturnedBook.definitionId!==currentExpectedCommand.definitionId)throw new Error('요청한 스킬북과 응답이 다릅니다.');
 const currentPurchaseRequest=currentExpectedCommand.purchase;
 if(currentPurchaseRequest){
  if(currentReturnedBook.requestId!==currentPurchaseRequest.requestId||currentReturnedBook.facilityId!==currentPurchaseRequest.facilityId
   ||currentReturnedBook.definitionVersion!==currentPurchaseRequest.definitionVersion||currentReturnedBook.priceP!==currentPurchaseRequest.priceP)
   throw new Error('스킬북 구매 영수증이 요청과 다릅니다.');
 }else if(currentReturnedBook.firstReadAt===null)throw new Error('스킬북 열람 완료 기록이 없습니다.');
}
