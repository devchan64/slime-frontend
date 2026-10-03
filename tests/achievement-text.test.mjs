import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({entryPoints:['src/client/achievementText.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { localizedAchievement, validateAchievementSeasonHistory, validateAchievementCatalogRecords } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const original = {name:'첫 승리',scope:'GENERAL',cp:1,sp:1,checklist:{win:{description:'1회 승리',target:1}}};
test('업적 이름과 조건을 함께 전환하고 원본 및 보상을 보존한다', () => {
 const definition = structuredClone(original);
 definition.translations={ko:{name:'첫 승리'},en:{name:'First Victory'}};
 definition.checklist.win.translations={ko:{description:'1회 승리'},en:{description:'Win one battle'}};
 const translated=localizedAchievement(definition,'en');
 assert.equal(translated.name,'First Victory');
 assert.equal(translated.checklist.win.description,'Win one battle');
 assert.equal(translated.checklist.win.target,1);
 assert.equal(translated.cp,1); assert.equal(translated.sp,1);
 assert.equal(localizedAchievement(translated,'ko').name,original.name);
 assert.equal(definition.name,original.name);
 assert.deepEqual(localizedAchievement(original,'en'),original);
});
test('언어 누락과 빈 이름 또는 조건을 즉시 거절한다', () => {
 for (const translations of [null,{}, {ko:{name:'이름'}}, {ko:{name:'이름'},en:{name:' '}}])
  assert.throws(()=>localizedAchievement({...original,translations},'en'));
 const definition=structuredClone(original);
 definition.checklist.win.translations={ko:{description:'설명'},en:{description:''}};
 assert.throws(()=>localizedAchievement(definition,'en'));
});


test('과거 시즌 정의 누락은 현재 업적 대체 없이 거절하고 정상 기록은 변경하지 않는다',()=>{
 const currentHistoryRecord={previous:{catalog:{old:original},achievements:{old:{completedAt:1,checklist:{win:{count:1}}}},seasonalAchievements:{},cpLedger:[{amount:1}],spLedger:[{amount:1}]}};
 const currentOriginalHistory=structuredClone(currentHistoryRecord);
 validateAchievementSeasonHistory(currentHistoryRecord);
 assert.deepEqual(currentHistoryRecord,currentOriginalHistory);
 validateAchievementSeasonHistory({});
 for(const currentMissingField of ['catalog','achievements','seasonalAchievements','cpLedger','spLedger']) {
   const currentInvalidHistory=structuredClone(currentHistoryRecord);
   delete currentInvalidHistory.previous[currentMissingField];
   assert.throws(()=>validateAchievementSeasonHistory(currentInvalidHistory));
 }
 for(const currentInvalidHistory of [null,[],{previous:null},{previous:[]}])
   assert.throws(()=>validateAchievementSeasonHistory(currentInvalidHistory));
});


test('현재 업적 카탈로그의 잘못된 번역은 렌더 전에 거절한다',()=>{
 validateAchievementCatalogRecords({current:original});
 for(const currentInvalidCatalog of [null,[],{current:null},{current:{...original,translations:{ko:{name:'이름'}}}}])
   assert.throws(()=>validateAchievementCatalogRecords(currentInvalidCatalog));
});
