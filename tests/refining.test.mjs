import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBundleResult=await build({entryPoints:['src/client/refining.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseRefiningContracts,parseRefiningCatalog,parseRefiningQuote}=await import(`data:text/javascript;base64,${Buffer.from(currentBundleResult.outputFiles[0].text).toString('base64')}`);
function createRefiningPage(){return {serverTime:150,characterVersion:3,nextCursor:null,entries:[{contractId:'one',facilityId:'workshop',startedAt:100,readyAt:130,claimedAt:null,status:'READY',quote:{grade:'low',outputQuantity:1,inputQuantity:2,costP:1,durationSeconds:30,outputMaterial:{materialId:'leather-low',name:'하급 가죽',englishName:'Low leather'}}}]};}
test('정제 계약 상태와 저장 견적을 읽는다',()=>{
 assert.equal(parseRefiningContracts(createRefiningPage()).entries[0].quote.costP,1);
 const currentContractPage=createRefiningPage();currentContractPage.entries[0].status='CLAIMED';currentContractPage.entries[0].claimedAt=140;
 assert.equal(parseRefiningContracts(currentContractPage).entries[0].status,'CLAIMED');
});
test('잘못된 정제 등급·수량·시각·상태·중복을 거절한다',()=>{
 for(const currentInvalidChange of [
  currentContractPage=>{currentContractPage.entries[0].quote.grade='missing';},
  currentContractPage=>{currentContractPage.entries[0].quote.outputQuantity=0;},
  currentContractPage=>{currentContractPage.entries[0].readyAt=120;},
  currentContractPage=>{currentContractPage.entries[0].status='IN_PROGRESS';},
  currentContractPage=>{currentContractPage.entries[0].claimedAt=200;},
  currentContractPage=>{currentContractPage.entries.push(currentContractPage.entries[0]);},
 ]) {const currentContractPage=createRefiningPage();currentInvalidChange(currentContractPage);assert.throws(()=>parseRefiningContracts(currentContractPage));}
});

test('정제 선택 목록과 견적은 등급·중복·잔고·토큰을 검증한다',()=>{
 const currentRecipeEntry={...createRefiningPage().entries[0].quote,collectionId:'hide'};
 const currentCatalogData={facilityId:'workshop',available:true,unavailableReason:null,grades:['low'],entries:[currentRecipeEntry]};
 assert.equal(parseRefiningCatalog(currentCatalogData).entries.length,1);
 assert.throws(()=>parseRefiningCatalog({...currentCatalogData,entries:[currentRecipeEntry,currentRecipeEntry]}));
 assert.throws(()=>parseRefiningCatalog({...currentCatalogData,grades:['high']}));
 assert.throws(()=>parseRefiningCatalog({...currentCatalogData,available:false}));
 assert.equal(parseRefiningCatalog({...currentCatalogData,available:false,unavailableReason:'CITY_SIZE_UNASSIGNED',grades:[],entries:[]}).available,false);
 const currentQuoteData={quote:{...currentRecipeEntry,ownedQuantity:2},quoteToken:'a'.repeat(64),characterVersion:1,ownedCoins:10};
 assert.equal(parseRefiningQuote(currentQuoteData).quote.ownedQuantity,2);
 assert.throws(()=>parseRefiningQuote({...currentQuoteData,ownedCoins:-1}));
 assert.throws(()=>parseRefiningQuote({...currentQuoteData,quoteToken:'missing'}));
});

function validateProcessingResponses(currentRecipeValue,currentExpectRejection=false) {
 const currentContractPage=createRefiningPage();
 currentContractPage.entries[0].quote=currentRecipeValue;
 const currentParserCalls=[()=>parseRefiningContracts(currentContractPage)];
 const currentCatalogEntry={...currentRecipeValue,collectionId:'hide'};
 currentParserCalls.push(()=>parseRefiningCatalog({facilityId:'workshop',available:true,unavailableReason:null,grades:['low'],entries:[currentCatalogEntry]}));
 currentParserCalls.push(()=>parseRefiningQuote({quote:{...currentCatalogEntry,ownedQuantity:2},quoteToken:'a'.repeat(64),characterVersion:1,ownedCoins:10}));
 for(const currentParserCall of currentParserCalls) {if(currentExpectRejection) assert.throws(currentParserCall); else currentParserCall();}
}

test('정련·정제와 일반 가공재·정수를 세 응답에서 보존한다',()=>{
 for(const currentProcessingMethod of ['refining','smelting']) {
  for(const currentMaterialFields of [{materialKind:'material',essenceAttribute:null},{materialKind:'essence',essenceAttribute:'water',name:'하급 물의 정수'}]) {
   const currentRecipeValue=createRefiningPage().entries[0].quote;
   currentRecipeValue.processingMethod=currentProcessingMethod;
   Object.assign(currentRecipeValue.outputMaterial,currentMaterialFields);
   const currentOriginalValue=structuredClone(currentRecipeValue);
   validateProcessingResponses(currentRecipeValue);
   assert.deepEqual(currentRecipeValue,currentOriginalValue);
  }
 }
});

test('잘못된 가공 방식과 모순·누락·미등록 메타데이터를 거절한다',()=>{
 for(const currentInvalidFields of [
  {materialKind:'missing',essenceAttribute:null}, {materialKind:'material',essenceAttribute:'water'},
  {materialKind:'essence',essenceAttribute:null}, {materialKind:'essence',essenceAttribute:true},
  {materialKind:'essence',essenceAttribute:'bad value',name:'물의 정수'},
  {materialKind:'essence',essenceAttribute:'water'}, {materialKind:'material'}, {essenceAttribute:null}, {extra:true},
 ]) {
  const currentRecipeValue=createRefiningPage().entries[0].quote;
  Object.assign(currentRecipeValue.outputMaterial,currentInvalidFields);
  validateProcessingResponses(currentRecipeValue,true);
 }
 for(const currentInvalidMethod of [null,undefined,true,'unknown',[],{}]) {
  const currentRecipeValue=createRefiningPage().entries[0].quote;
  currentRecipeValue.processingMethod=currentInvalidMethod;
  validateProcessingResponses(currentRecipeValue,true);
 }
});
