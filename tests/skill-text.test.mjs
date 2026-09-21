import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({entryPoints:['src/client/skillText.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { localizedSkill } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const base = {id:'new_skill',name:'새 스킬',description:'설명',icon:'◇'};
test('새 스킬도 서버 번역을 선택하며 이전 정의는 원문을 보존한다', () => {
 const definition = {...base,translations:{ko:{name:'새 스킬',description:'설명'},en:{name:'New skill',description:'Description'}}};
 assert.equal(localizedSkill(definition,'en').name,'New skill');
 assert.equal(localizedSkill(definition,'ko').name,'새 스킬');
 assert.equal(localizedSkill(base,'en'),base);
 assert.equal(definition.name,'새 스킬');
});
test('불완전한 번역은 원문으로 숨기지 않고 거절한다', () => {
 for (const translations of [null,{}, {en:{name:'X',description:'Y'}}, {ko:{name:'X',description:'Y'},en:{name:' ',description:'Y'}}])
  assert.throws(() => localizedSkill({...base,translations},'en'));
});

test('확정 액션 안내는 보존하고 잘못된 레벨·비용·장비·중복은 거절한다', () => {
 const currentActionDefinition={actionId:'one_hand_finishing_strike',name:'일격필살',requiredLevel:7,apCost:10,powerBasisPoints:30000,requiredEquipment:'one_handed_sword'};
 assert.deepEqual(localizedSkill({...base,actions:[currentActionDefinition]},'ko').actions,[currentActionDefinition]);
 for(const currentInvalidActions of [null,{},[{...currentActionDefinition,apCost:0}],[{...currentActionDefinition,requiredLevel:true}],
   [{...currentActionDefinition,powerBasisPoints:NaN}],[{...currentActionDefinition,requiredEquipment:'unknown'}],
   [currentActionDefinition,currentActionDefinition]])
   assert.throws(()=>localizedSkill({...base,actions:currentInvalidActions},'ko'));
});
