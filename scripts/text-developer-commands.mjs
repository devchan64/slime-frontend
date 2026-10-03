/** 개발자 명령은 인증된 본인만 대상으로 하며 기존 재시도 원장을 공유한다. */
export async function executeDeveloperCommand(currentTextClient,currentCommandArguments){
 if(!currentTextClient.tokens||!currentTextClient.state?.me?.name)throw new Error('로그인하고 캐릭터를 만든 뒤 이용하세요.');
 const [currentActionName,currentAssetArgument,currentQuantityArgument]=currentCommandArguments;
 const currentSessionTokens=currentTextClient.tokens;
 const currentCharacterIdentifier=currentTextClient.state.me.id;
 const currentSessionGeneration=currentTextClient.state.generation;
 const requireCurrentDeveloperSession=()=>{
  if(currentTextClient.tokens!==currentSessionTokens||currentTextClient.state?.me.id!==currentCharacterIdentifier||currentTextClient.state.generation!==currentSessionGeneration)
   throw new Error('개발자 조회 중 로그인 세션이 변경되었습니다.');
 };
 if(currentActionName==='status'&&currentCommandArguments.length===1){
  const currentCapabilities=await currentTextClient.request('/v1/developer/capabilities');requireCurrentDeveloperSession();
  if(currentCapabilities.accountId!==currentSessionTokens.user_id||currentCapabilities.targetScope!=='SELF'||!Array.isArray(currentCapabilities.assets)
    ||currentCapabilities.assets.some(currentAssetName=>!['CP','SP','P'].includes(currentAssetName)))throw new Error('개발자 권한 응답이 올바르지 않습니다.');
  return '개발자 도구 · 본인 캐릭터 전용 · '+currentCapabilities.assets.join(', ');
 }
 if(currentActionName==='history'&&(currentCommandArguments.length===1||currentCommandArguments.length===2)){
  if(currentAssetArgument&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentAssetArgument))throw new Error('변경 이력의 다음 커서 UUID를 입력하세요.');
  const currentHistoryPage=await currentTextClient.request('/v1/developer/adjustments'+(currentAssetArgument?'?after='+encodeURIComponent(currentAssetArgument):''));requireCurrentDeveloperSession();
  if(currentHistoryPage.characterId!==currentCharacterIdentifier||!Array.isArray(currentHistoryPage.entries)
    ||currentHistoryPage.entries.some(currentReceiptRecord=>currentReceiptRecord.characterId!==currentCharacterIdentifier||currentReceiptRecord.actorId!==currentSessionTokens.user_id
     ||!['CP','SP','P'].includes(currentReceiptRecord.asset)||!['ADD','REMOVE'].includes(currentReceiptRecord.operation)
     ||![currentReceiptRecord.before,currentReceiptRecord.after,currentReceiptRecord.quantity].every(Number.isSafeInteger)
     ||typeof currentReceiptRecord.requestId!=='string'||!Number.isFinite(currentReceiptRecord.createdAt))
    ||(currentHistoryPage.nextCursor!==null&&typeof currentHistoryPage.nextCursor!=='string'))throw new Error('개발자 변경 이력 응답이 올바르지 않습니다.');
  return currentHistoryPage.entries.map(currentReceiptRecord=>new Date(currentReceiptRecord.createdAt*1000).toISOString()+' · '+currentReceiptRecord.asset+' '+currentReceiptRecord.before+' → '+currentReceiptRecord.after+' · '+currentReceiptRecord.requestId).join('\n')
   +'\n'+(currentHistoryPage.nextCursor?'다음: dev history '+currentHistoryPage.nextCursor:'이력 끝');
 }
 if(currentActionName==='inventory'&&currentCommandArguments.length===1){
  const currentInventory=await currentTextClient.request('/v1/developer/inventory');requireCurrentDeveloperSession();
  if(currentInventory.characterId!==currentCharacterIdentifier||!Number.isSafeInteger(currentInventory.version)
    ||!['CP','SP','P'].every(currentAssetName=>Number.isSafeInteger(currentInventory.balances?.[currentAssetName])&&currentInventory.balances[currentAssetName]>=0))
   throw new Error('개발자 잔고 응답이 올바르지 않습니다.');
  return ['CP','SP','P'].map(currentAssetName=>currentAssetName+' '+currentInventory.balances[currentAssetName]).join(' · ');
 }
 if(!['add','remove'].includes(currentActionName)||currentCommandArguments.length!==3||!['cp','sp','p'].includes(currentAssetArgument)
   ||!/^[1-9][0-9]*$/.test(currentQuantityArgument)||!Number.isSafeInteger(Number(currentQuantityArgument))||Number(currentQuantityArgument)>1000000000)
  throw new Error('dev status / inventory / add|remove cp|sp|p 수량(1~1000000000) 형식으로 입력하세요.');
 const currentAssetName=currentAssetArgument.toUpperCase();
 return currentTextClient.command('/v1/developer/adjustments',{
  operation:currentActionName==='add'?'ADD':'REMOVE',asset:currentAssetName,quantity:Number(currentQuantityArgument),
 },currentReceiptRecord=>`${currentAssetName} ${currentReceiptRecord.before} → ${currentReceiptRecord.after} · 요청 ${currentReceiptRecord.requestId}`,{
  fetchStateAfterReceipt:true,readReceiptCharacterVersion:currentReceiptRecord=>currentReceiptRecord.version,
  validateCommandResponse:(currentReceiptRecord,currentRequestBody)=>{
   if(currentReceiptRecord.ok!==true||currentReceiptRecord.requestId!==currentRequestBody.requestId
     ||currentReceiptRecord.actorId!==currentSessionTokens.user_id||currentReceiptRecord.characterId!==currentCharacterIdentifier
     ||currentReceiptRecord.asset!==currentRequestBody.asset||currentReceiptRecord.operation!==currentRequestBody.operation
     ||currentReceiptRecord.quantity!==currentRequestBody.quantity||currentReceiptRecord.version!==currentRequestBody.expectedVersion+1
     ||![currentReceiptRecord.before,currentReceiptRecord.after].every(currentBalanceValue=>Number.isSafeInteger(currentBalanceValue)&&currentBalanceValue>=0)
     ||currentReceiptRecord.after-currentReceiptRecord.before!==currentRequestBody.quantity*(currentRequestBody.operation==='ADD'?1:-1))
    throw new Error('개발자 조정 영수증이 요청과 일치하지 않습니다.');
  },
 });
}
