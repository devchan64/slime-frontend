import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentCompiledBundle=await build({entryPoints:['src/client/guildTrade.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseGuildMaterialCatalog,parseGuildMaterialQuote,validateGuildSaleReceipt}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
const currentMaterialFixture={characterVersion:1,policyVersion:1,maximumQuantity:100,items:[{materialId:'herb',quantity:3,unitPriceP:2,nameTranslations:{ko:'약초',en:'Herb'}}]};
const currentQuoteFixture={characterVersion:1,policyVersion:1,maximumQuantity:100,materialId:'herb',quantity:2,unitPriceP:2,totalPriceP:4};
test('보유 수량·가격과 요청 대상이 일치하는 견적만 허용한다',()=>{
 assert.equal(parseGuildMaterialCatalog(currentMaterialFixture).items.length,1);
 assert.equal(parseGuildMaterialQuote(currentQuoteFixture,'herb',2).totalPriceP,4);
 assert.throws(()=>parseGuildMaterialCatalog({...currentMaterialFixture,items:[...currentMaterialFixture.items,...currentMaterialFixture.items]}));
 for(const currentInvalidPatch of [{totalPriceP:3},{unitPriceP:-1},{quantity:1},{materialId:'salt'},{maximumQuantity:1},{policyVersion:true}])
  assert.throws(()=>parseGuildMaterialQuote({...currentQuoteFixture,...currentInvalidPatch},'herb',2));
});
test('복구 영수증이 원래 요청·시설·수령액과 일치해야 한다',()=>{
 const currentOriginalRequest={requestId:'22222222-2222-4222-8222-222222222222',materialId:'herb',quantity:2,unitPriceP:2,policyVersion:1};
 const currentReceiptFixture={...currentOriginalRequest,saleId:'11111111-1111-4111-8111-111111111111',facilityId:'iseulon-guild',completedAt:10,totalPriceP:4};
 validateGuildSaleReceipt(currentReceiptFixture,currentOriginalRequest,'iseulon-guild');
 for(const currentInvalidPatch of [{requestId:'other'},{materialId:'salt'},{totalPriceP:5},{quantity:3},{facilityId:'other'}])
  assert.throws(()=>validateGuildSaleReceipt({...currentReceiptFixture,...currentInvalidPatch},currentOriginalRequest,'iseulon-guild'));
});

test('시민권 가격의 도시·금액·만료 시각을 검증한다',async()=>{
 const {parseCitizenshipPriceQuote}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
 const currentPriceFixture={cityId:'iseulon',policyVersion:1,priceP:100,serverTime:10,expiresAt:70};
 assert.equal(parseCitizenshipPriceQuote(currentPriceFixture,'iseulon').priceP,100);
 for(const currentInvalidPatch of [{cityId:'other'},{priceP:0},{priceP:'100'},{expiresAt:10},{serverTime:Infinity},{policyVersion:true}])
  assert.throws(()=>parseCitizenshipPriceQuote({...currentPriceFixture,...currentInvalidPatch},'iseulon'));
});
