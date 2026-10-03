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

test('소포 지급 책의 0p 소유 기록은 허용하고 음수 가격은 거절한다',()=>{
 const currentBookResponse=createSkillbookResponse();
 currentBookResponse.books[0].priceP=0;
 assert.equal(parseSkillbookInventory(currentBookResponse).books[0].priceP,0);
 currentBookResponse.books[0].priceP=-1;
 assert.throws(()=>parseSkillbookInventory(currentBookResponse));
});

test('스킬카드 보관과 영수증의 소유자·결제·소비 계약을 검증한다',async()=>{
 const {parseSkillCardInventory,validateSkillCardCommandResponse}=await import('../src/client/skill-card-validation.mjs');
 const currentCardEntry={cardId:'monster-dissection-card',definitionVersion:1,literacyRequired:1,grantsSkill:'monster_dissection',nameTranslations:{ko:'몬스터 해부 스킬카드',en:'Monster Dissection Skill Card'},learned:false,
  storage:'ACCOUNT',expiresAt:null,source:'purchase',acquiredAt:100,currentLiteracy:1};
 const currentCardResponse={characterVersion:2,cards:[currentCardEntry],catalog:[{...currentCardEntry,priceP:100,owned:true}]};
 assert.equal(parseSkillCardInventory(currentCardResponse),currentCardResponse);
 for(const currentInvalidPatch of [{expiresAt:200},{source:'unknown'},{currentLiteracy:-1},{learned:0},{cardId:12}]){
  assert.throws(()=>parseSkillCardInventory({...currentCardResponse,cards:[{...currentCardEntry,...currentInvalidPatch}]}));
 }
 const currentCommandIdentity={kind:'purchase',cardId:currentCardEntry.cardId,facilityId:'iseulon-bookshop',definitionVersion:1,priceP:100};
 const currentExpectedCommand={characterId:'hero',generation:1,expectedVersion:2,requestId:'00000000-0000-4000-8000-000000000001',command:currentCommandIdentity};
 const currentCommandResponse={state:{protocolVersion:1,generation:1,epoch:1,cursor:2,me:{id:'hero',version:3}},receipt:{requestId:currentExpectedCommand.requestId,command:currentCommandIdentity,
  completedAt:100,result:{cardId:currentCardEntry.cardId,priceP:100,storage:'ACCOUNT',expiresAt:null}}};
 validateSkillCardCommandResponse(currentCommandResponse,currentExpectedCommand);
 for(const currentMutationAction of [currentResponseValue=>currentResponseValue.receipt.result.priceP=99,currentResponseValue=>currentResponseValue.state.me.id='other',
  currentResponseValue=>currentResponseValue.receipt.requestId='wrong',currentResponseValue=>currentResponseValue.receipt.command.cardId='wrong']){
  const currentInvalidResponse=structuredClone(currentCommandResponse);currentMutationAction(currentInvalidResponse);
  assert.throws(()=>validateSkillCardCommandResponse(currentInvalidResponse,currentExpectedCommand));
 }
 const currentUseIdentity={kind:'use',cardId:currentCardEntry.cardId};
 currentCommandResponse.receipt.command=currentUseIdentity;
 currentCommandResponse.receipt.result={cardId:currentCardEntry.cardId,skillId:'monster_dissection',level:0};
 currentCommandResponse.state.me.skills={monster_dissection:0};
 validateSkillCardCommandResponse(currentCommandResponse,{...currentExpectedCommand,command:currentUseIdentity,grantsSkill:'monster_dissection'});
 delete currentCommandResponse.state.me.skills.monster_dissection;
 assert.throws(()=>validateSkillCardCommandResponse(currentCommandResponse,{...currentExpectedCommand,command:currentUseIdentity,grantsSkill:'monster_dissection'}));
});
