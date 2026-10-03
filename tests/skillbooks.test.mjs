import {test} from 'node:test';
import assert from 'node:assert/strict';

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
