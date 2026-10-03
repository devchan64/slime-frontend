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
 if(currentActionName==='items'&&currentCommandArguments.length===1){
  const currentCatalogResponse=await currentTextClient.request('/v1/developer/catalog');requireCurrentDeveloperSession();
  const currentAllowedCategories=['material','collection','refined_material','consumable','equipment','skill_card','costume','traveler_permit'];
  const currentCatalogKeys=new Set();
  if(currentCatalogResponse.accountId!==currentSessionTokens.user_id||currentCatalogResponse.targetScope!=='SELF'||!Array.isArray(currentCatalogResponse.entries)
   ||currentCatalogResponse.entries.some(currentCatalogEntry=>{
    const currentCatalogKey=currentCatalogEntry.category+':'+currentCatalogEntry.itemId;
    const currentEntryInvalid=!currentAllowedCategories.includes(currentCatalogEntry.category)||typeof currentCatalogEntry.itemId!=='string'||!currentCatalogEntry.itemId
     ||typeof currentCatalogEntry.nameTranslations?.ko!=='string'||!currentCatalogEntry.nameTranslations.ko
     ||!Array.isArray(currentCatalogEntry.supportedOperations)||currentCatalogEntry.supportedOperations.some(currentOperationName=>!['ADD','REMOVE'].includes(currentOperationName))
     ||currentCatalogKeys.has(currentCatalogKey);
    currentCatalogKeys.add(currentCatalogKey);return currentEntryInvalid;
   }))throw new Error('개발자 품목 응답이 올바르지 않습니다.');
  return currentCatalogResponse.entries.map(currentCatalogEntry=>currentCatalogEntry.category+' '+currentCatalogEntry.itemId+' · '+currentCatalogEntry.nameTranslations.ko
   +' · '+(currentCatalogEntry.supportedOperations.length?currentCatalogEntry.supportedOperations.join(', '):'조정 미지원')).join('\n');
 }
 if(currentActionName==='permit'&&currentCommandArguments[1]==='issuers'&&currentCommandArguments.length===2){
  const currentCatalogResponse=await currentTextClient.request('/v1/developer/catalog');requireCurrentDeveloperSession();
  if(currentCatalogResponse.accountId!==currentSessionTokens.user_id||!Array.isArray(currentCatalogResponse.permitIssuers)||currentCatalogResponse.permitIssuers.some(currentIssuerEntry=>typeof currentIssuerEntry.cityId!=='string'||typeof currentIssuerEntry.issuerId!=='string'))throw new Error('여행자증명서 발급처 응답이 올바르지 않습니다.');
  return currentCatalogResponse.permitIssuers.map(currentIssuerEntry=>currentIssuerEntry.cityId+' · '+currentIssuerEntry.issuerId).join('\n');
 }
 if(currentActionName==='history'&&(currentCommandArguments.length===1||currentCommandArguments.length===2)){
  if(currentAssetArgument&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentAssetArgument))throw new Error('변경 이력의 다음 커서 UUID를 입력하세요.');
  const currentHistoryPage=await currentTextClient.request('/v1/developer/adjustments'+(currentAssetArgument?'?after='+encodeURIComponent(currentAssetArgument):''));requireCurrentDeveloperSession();
  if(currentHistoryPage.characterId!==currentCharacterIdentifier||!Array.isArray(currentHistoryPage.entries)
    ||currentHistoryPage.entries.some(currentReceiptRecord=>currentReceiptRecord.characterId!==currentCharacterIdentifier||currentReceiptRecord.actorId!==currentSessionTokens.user_id
     ||!['CP','SP','P','ITEM'].includes(currentReceiptRecord.asset)||(currentReceiptRecord.asset==='ITEM'&&(typeof currentReceiptRecord.itemId!=='string'||typeof currentReceiptRecord.category!=='string'))||!['ADD','REMOVE'].includes(currentReceiptRecord.operation)
     ||![currentReceiptRecord.before,currentReceiptRecord.after,currentReceiptRecord.quantity].every(Number.isSafeInteger)
     ||typeof currentReceiptRecord.requestId!=='string'||!Number.isFinite(currentReceiptRecord.createdAt))
    ||(currentHistoryPage.nextCursor!==null&&typeof currentHistoryPage.nextCursor!=='string'))throw new Error('개발자 변경 이력 응답이 올바르지 않습니다.');
  return currentHistoryPage.entries.map(currentReceiptRecord=>new Date(currentReceiptRecord.createdAt*1000).toISOString()+' · '+(currentReceiptRecord.asset==='ITEM'?currentReceiptRecord.category+' '+currentReceiptRecord.itemId:currentReceiptRecord.asset)+' '+currentReceiptRecord.before+' → '+currentReceiptRecord.after+' · '+currentReceiptRecord.requestId).join('\n')
   +'\n'+(currentHistoryPage.nextCursor?'다음: dev history '+currentHistoryPage.nextCursor:'이력 끝');
 }
 if(currentActionName==='inventory'&&currentCommandArguments.length===1){
  const currentInventory=await currentTextClient.request('/v1/developer/inventory');requireCurrentDeveloperSession();
  if(currentInventory.characterId!==currentCharacterIdentifier||!Number.isSafeInteger(currentInventory.version)
    ||!['CP','SP','P'].every(currentAssetName=>Number.isSafeInteger(currentInventory.balances?.[currentAssetName])&&currentInventory.balances[currentAssetName]>=0))
   throw new Error('개발자 잔고 응답이 올바르지 않습니다.');
  if(!Array.isArray(currentInventory.items)||currentInventory.items.some(currentItemEntry=>typeof currentItemEntry.category!=='string'||typeof currentItemEntry.itemId!=='string'||!Number.isSafeInteger(currentItemEntry.quantity)||currentItemEntry.quantity<1))throw new Error('개발자 재고 응답이 올바르지 않습니다.');
  return ['CP','SP','P'].map(currentAssetName=>currentAssetName+' '+currentInventory.balances[currentAssetName]).join(' · ')+'\n'+currentInventory.items.map(currentItemEntry=>currentItemEntry.category+' '+currentItemEntry.itemId+' '+currentItemEntry.quantity+(currentItemEntry.instanceId?' · '+currentItemEntry.instanceId+(currentItemEntry.category==='equipment'?' · v'+currentItemEntry.instanceVersion+' · '+(currentItemEntry.removable?'회수 가능':'사용 중'):''):'')).join('\n');
 }
 const currentPermitRequested=currentActionName==='permit';
 const currentItemRequested=currentActionName==='item'||currentPermitRequested;
 const currentOperationArgument=currentItemRequested?currentCommandArguments[1]:currentActionName;
 const currentItemCategory=currentPermitRequested?'traveler_permit':currentItemRequested?currentCommandArguments[2]:undefined;
 let currentItemIdentifier=currentPermitRequested?'city-traveler-permit':currentItemRequested?currentCommandArguments[3]:undefined;
 const currentEquipmentRemoval=currentItemCategory==='equipment'&&currentOperationArgument==='remove';
 const currentQuantityText=currentPermitRequested||currentEquipmentRemoval?'1':currentItemRequested?currentCommandArguments[4]:currentQuantityArgument;
 let currentEquipmentFields=currentPermitRequested?(currentOperationArgument==='add'?{cityId:currentCommandArguments[2],issuerId:currentCommandArguments[3]}:{instanceId:currentCommandArguments[2]}):{};
 if(currentEquipmentRemoval&&currentCommandArguments.length===4){
  const currentInventoryResponse=await currentTextClient.request('/v1/developer/inventory');requireCurrentDeveloperSession();
  if(currentInventoryResponse.characterId!==currentCharacterIdentifier||currentInventoryResponse.version!==currentTextClient.state.me.version||!Array.isArray(currentInventoryResponse.items))throw new Error('상태가 변경되었습니다. state 명령으로 갱신하세요.');
  const currentOwnedEquipment=currentInventoryResponse.items.find(currentItemEntry=>currentItemEntry.category==='equipment'&&currentItemEntry.instanceId===currentItemIdentifier);
  if(!currentOwnedEquipment||!currentOwnedEquipment.removable||!Number.isSafeInteger(currentOwnedEquipment.instanceVersion)||currentOwnedEquipment.instanceVersion<1)throw new Error('회수 가능한 본인 장비 개체 ID를 지정하세요.');
  currentEquipmentFields={instanceId:currentOwnedEquipment.instanceId,expectedInstanceVersion:currentOwnedEquipment.instanceVersion};currentItemIdentifier=currentOwnedEquipment.itemId;
 }
 if(!['add','remove'].includes(currentOperationArgument)||currentCommandArguments.length!==(currentPermitRequested?(currentOperationArgument==='add'?4:3):currentEquipmentRemoval?4:currentItemRequested?5:3)
   ||(currentItemRequested?!['material','collection','refined_material','consumable','skill_card','equipment','traveler_permit'].includes(currentItemCategory)||!currentItemIdentifier:!['cp','sp','p'].includes(currentAssetArgument))
   ||(['skill_card','equipment','traveler_permit'].includes(currentItemCategory)&&currentQuantityText!=='1')
   ||!/^[1-9][0-9]*$/.test(currentQuantityText)||!Number.isSafeInteger(Number(currentQuantityText))||Number(currentQuantityText)>1000000000)
  throw new Error('dev add|remove cp|sp|p 수량 또는 dev item add|remove 분류 품목ID 수량(1~1000000000) 형식으로 입력하세요.');
 const currentAssetName=currentItemRequested?'ITEM':currentAssetArgument.toUpperCase();
 const currentAssetLabel=currentItemRequested?currentItemCategory+' '+currentItemIdentifier:currentAssetName;
 return currentTextClient.command('/v1/developer/adjustments',{
  operation:currentOperationArgument==='add'?'ADD':'REMOVE',asset:currentAssetName,quantity:Number(currentQuantityText),
  ...(currentItemRequested?{category:currentItemCategory,itemId:currentItemIdentifier}:{}),...currentEquipmentFields,
 },currentReceiptRecord=>`${currentAssetLabel} ${currentReceiptRecord.before} → ${currentReceiptRecord.after}${currentReceiptRecord.instanceId?' · '+currentReceiptRecord.instanceId:''} · 요청 ${currentReceiptRecord.requestId}`,{
  fetchStateAfterReceipt:true,readReceiptCharacterVersion:currentReceiptRecord=>currentReceiptRecord.version,
  validateCommandResponse:(currentReceiptRecord,currentRequestBody)=>{
   if(currentReceiptRecord.ok!==true||currentReceiptRecord.requestId!==currentRequestBody.requestId
     ||currentReceiptRecord.actorId!==currentSessionTokens.user_id||currentReceiptRecord.characterId!==currentCharacterIdentifier
     ||currentReceiptRecord.asset!==currentRequestBody.asset||currentReceiptRecord.operation!==currentRequestBody.operation
     ||currentReceiptRecord.itemId!==currentRequestBody.itemId||currentReceiptRecord.category!==currentRequestBody.category
     ||(currentRequestBody.category==='traveler_permit'&&(typeof currentReceiptRecord.instanceId!=='string'||currentReceiptRecord.permit?.characterId!==currentCharacterIdentifier||(currentRequestBody.operation==='REMOVE'?currentReceiptRecord.instanceId!==currentRequestBody.instanceId:currentReceiptRecord.permit.cityId!==currentRequestBody.cityId||currentReceiptRecord.permit.issuerId!==currentRequestBody.issuerId)))
     ||(currentRequestBody.category==='equipment'&&(typeof currentReceiptRecord.instanceId!=='string'||!Number.isSafeInteger(currentReceiptRecord.instanceVersion)||(currentRequestBody.operation==='REMOVE'&&(currentReceiptRecord.instanceId!==currentRequestBody.instanceId||currentReceiptRecord.instanceVersion!==currentRequestBody.expectedInstanceVersion+1))))
     ||currentReceiptRecord.quantity!==currentRequestBody.quantity||currentReceiptRecord.version!==currentRequestBody.expectedVersion+1
     ||![currentReceiptRecord.before,currentReceiptRecord.after].every(currentBalanceValue=>Number.isSafeInteger(currentBalanceValue)&&currentBalanceValue>=0)
     ||currentReceiptRecord.after-currentReceiptRecord.before!==currentRequestBody.quantity*(currentRequestBody.operation==='ADD'?1:-1))
    throw new Error('개발자 조정 영수증이 요청과 일치하지 않습니다.');
  },
 });
}
