import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild = await build({entryPoints:['src/client/travelerIssuance.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseTravelerPermitQuote,validateTravelerPurchaseReceipt,findFieldGuardCenter} = await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
const currentGuardDefinition = {id:'moss-to-city-guard-center',cityId:'iseulon',mapId:'moss-clearing',connectionId:'moss-to-city',name:'이슬온 경비센터',position:{column:31,row:16}};
const currentValidQuote = {guardCenterId:currentGuardDefinition.id,cityId:'iseulon',policyVersion:1,priceP:5,validitySeconds:604800,serverTime:100,expiresAt:160};
const currentPurchaseRequest = {requestId:'request-one',expectedVersion:1,policyVersion:1,priceP:5,quotedExpiresAt:160};
function createValidPurchaseReceipt() {
  return {requestId:'request-one',guardCenterId:currentGuardDefinition.id,policyVersion:1,priceP:5,quotedExpiresAt:160,
    permit:{instanceId:'permit-one',itemId:'city-traveler-permit',characterId:'owner',cityId:'iseulon',issuerId:currentGuardDefinition.id,issuedAt:110,expiresAt:604910}};
}
test('발급 견적은 현지 경비센터·도시·5p·7일과 정확한 필드를 검증한다',()=>{
  assert.equal(parseTravelerPermitQuote(currentValidQuote,currentGuardDefinition).priceP,5);
  for (const currentInvalidPatch of [{guardCenterId:'other'},{cityId:'other'},{priceP:6},{validitySeconds:7},{policyVersion:true},{expiresAt:100},{extra:1}])
    assert.throws(()=>parseTravelerPermitQuote({...currentValidQuote,...currentInvalidPatch},currentGuardDefinition));
});
test('영수증의 요청·소유자·기간·발급처 위조를 거절한다',()=>{
  validateTravelerPurchaseReceipt(createValidPurchaseReceipt(),currentPurchaseRequest,currentGuardDefinition,'owner');
  for(const currentInvalidPatch of [{requestId:'other'},{priceP:1},{quotedExpiresAt:170}]) assert.throws(()=>validateTravelerPurchaseReceipt({...createValidPurchaseReceipt(),...currentInvalidPatch},currentPurchaseRequest,currentGuardDefinition,'owner'));
  for(const currentInvalidPatch of [{characterId:'other'},{issuerId:'other'},{cityId:'other'},{expiresAt:604911},{extra:1}]) {
    const currentReceiptValue=createValidPurchaseReceipt();Object.assign(currentReceiptValue.permit,currentInvalidPatch);
    assert.throws(()=>validateTravelerPurchaseReceipt(currentReceiptValue,currentPurchaseRequest,currentGuardDefinition,'owner'));
  }
});
test('필드의 실제 도시행 입구에 연결된 경비센터만 선택한다',()=>{
  const currentMapDefinition={id:'moss-clearing',guardCenters:[currentGuardDefinition],connections:[{id:'moss-to-city',target:'iseulon',targetSafeTown:true,column:31,row:16}]};
  assert.equal(findFieldGuardCenter(currentMapDefinition,'moss-to-city').id,currentGuardDefinition.id);
  assert.equal(findFieldGuardCenter({...currentMapDefinition,guardCenters:undefined},'moss-to-city'),undefined);
  for(const currentInvalidMap of [{...currentMapDefinition,safeTown:true},{...currentMapDefinition,id:'other'}, {...currentMapDefinition,guardCenters:[currentGuardDefinition,currentGuardDefinition]}]) assert.throws(()=>findFieldGuardCenter(currentInvalidMap,'moss-to-city'));
});
