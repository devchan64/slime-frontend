import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/skillbooks.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseSkillbookInventory}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function createSkillbookResponse(){return {characterVersion:1,books:[{definitionId:'monster-lore-book',definitionVersion:3,priceP:50,literacyRequired:3,grantsSkill:'monster_lore',nameTranslations:{ko:'몬스터학',en:'Monster Lore'},requestId:'request',facilityId:'iseulon-bookshop',purchasedAt:100,firstReadAt:null,weightG:450}]};}
test('소유 책의 열람 전후 응답을 검증한다',()=>{
  const currentBookResponse=createSkillbookResponse();
  assert.equal(parseSkillbookInventory(currentBookResponse).books[0].firstReadAt,null);
  currentBookResponse.books[0].firstReadAt=101;
  assert.equal(parseSkillbookInventory(currentBookResponse).books[0].firstReadAt,101);
});
test('잘못된 소유 기록과 중복 목록을 거절한다',()=>{
  for(const currentBookPatch of [{weightG:-1},{firstReadAt:99},{purchasedAt:NaN},{definitionVersion:true},{nameTranslations:{ko:'책'}},{literacyRequired:0}]){
    const currentBookResponse=createSkillbookResponse();Object.assign(currentBookResponse.books[0],currentBookPatch);
    assert.throws(()=>parseSkillbookInventory(currentBookResponse));
  }
  const currentBookResponse=createSkillbookResponse();currentBookResponse.books.push(currentBookResponse.books[0]);
  assert.throws(()=>parseSkillbookInventory(currentBookResponse));
});
test('서점 소유 여부가 실제 목록과 일치해야 한다',()=>{
  const currentBookResponse=createSkillbookResponse();currentBookResponse.catalog=[{...currentBookResponse.books[0],owned:true}];
  assert.equal(parseSkillbookInventory(currentBookResponse).catalog[0].owned,true);
  currentBookResponse.catalog[0].owned=false;
  assert.throws(()=>parseSkillbookInventory(currentBookResponse));
});
