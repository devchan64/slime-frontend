import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledJournalBundle=await build({entryPoints:['src/client/mainEventJournal.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseMainEventJournal}=await import(`data:text/javascript;base64,${Buffer.from(compiledJournalBundle.outputFiles[0].text).toString('base64')}`);
const currentJournalNpc={id:'npc',name:'하린',cityId:'iseulon',facilityId:'iseulon-guild'};
const currentJournalFixture={serverTime:30,characterVersion:2,entries:[{eventId:'first',title:'첫 납품',acceptedAt:10,completedAt:null,moneyP:4,status:'ACCEPTED',materialsSufficient:true,giver:currentJournalNpc,receiver:currentJournalNpc,items:[{itemId:'protein-jelly',required:2,owned:3,nameTranslations:{ko:'단백질젤리',en:'Protein jelly'}}]}]};
test('진행·완료·빈 기록의 계약을 검증한다',()=>{
 assert.deepEqual(parseMainEventJournal(currentJournalFixture),currentJournalFixture);
 assert.equal(parseMainEventJournal({...currentJournalFixture,entries:[]}).entries.length,0);
 const completedJournalFixture=structuredClone(currentJournalFixture);
 Object.assign(completedJournalFixture.entries[0],{status:'COMPLETED',completedAt:20,materialsSufficient:false});
 assert.equal(parseMainEventJournal(completedJournalFixture).entries[0].status,'COMPLETED');
});
test('누락·중복·불가능한 완료 시각·잘못된 수량·충족 정보 불일치는 거절한다',()=>{
 const invalidJournalMutations=[
  currentJournalPage=>delete currentJournalPage.serverTime,
  currentJournalPage=>currentJournalPage.entries.push(structuredClone(currentJournalPage.entries[0])),
  currentJournalPage=>currentJournalPage.entries[0].items.push(structuredClone(currentJournalPage.entries[0].items[0])),
  currentJournalPage=>currentJournalPage.entries[0].items[0].owned=-1,
  currentJournalPage=>currentJournalPage.entries[0].items[0].required=true,
  currentJournalPage=>currentJournalPage.entries[0].materialsSufficient=false,
  currentJournalPage=>Object.assign(currentJournalPage.entries[0],{status:'COMPLETED',completedAt:5,materialsSufficient:false}),
  currentJournalPage=>currentJournalPage.entries[0].receiver.expiresAt=100,
  currentJournalPage=>delete currentJournalPage.entries[0].items[0].nameTranslations.en,
 ];
 for(const mutateJournalPage of invalidJournalMutations){const invalidJournalPage=structuredClone(currentJournalFixture);mutateJournalPage(invalidJournalPage);assert.throws(()=>parseMainEventJournal(invalidJournalPage));}
});

test('통합 수령 한도는 메인 목록 길이와 다를 수 있고 이전 응답도 유지한다',()=>{
 assert.equal(parseMainEventJournal({...currentJournalFixture,acceptedCount:4,maximumAcceptedCount:5}).acceptedCount,4);
 assert.equal(parseMainEventJournal({...currentJournalFixture,acceptedCount:6,maximumAcceptedCount:5}).acceptedCount,6);
 assert.equal(parseMainEventJournal(currentJournalFixture).acceptedCount,undefined);
 for(const currentCapacityFields of [{acceptedCount:1},{maximumAcceptedCount:5},{acceptedCount:-1,maximumAcceptedCount:5},
   {acceptedCount:1,maximumAcceptedCount:0},{acceptedCount:true,maximumAcceptedCount:5}])
   assert.throws(()=>parseMainEventJournal({...currentJournalFixture,...currentCapacityFields}));
});
