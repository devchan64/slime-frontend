import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentCompiledBundle=await build({entryPoints:['src/client/partyFormation.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parsePartyCandidatePage,validatePartyFormationReceipt}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
test('후보 응답의 도시·중복·정원을 검증한다',()=>{
 const currentPageFixture={cityId:'iseulon',characterVersion:1,serverTime:10,nextCursor:null,entries:[{characterId:'hero',name:'모험가',source:'USER',status:'AVAILABLE',cpEligible:true,remainingBorrowerSlots:3}]};
 assert.equal(parsePartyCandidatePage(currentPageFixture,'iseulon').entries.length,1);
 assert.throws(()=>parsePartyCandidatePage(currentPageFixture,'other'));
 assert.throws(()=>parsePartyCandidatePage({...currentPageFixture,entries:[...currentPageFixture.entries,...currentPageFixture.entries]},'iseulon'));
 assert.throws(()=>parsePartyCandidatePage({...currentPageFixture,entries:[{...currentPageFixture.entries[0],remainingBorrowerSlots:4}]},'iseulon'));
});
test('편성 영수증은 요청·동작·최종 목록과 일치해야 한다',()=>{
 const currentReceiptFixture={requestId:'request',action:'ADD',loanId:'loan',loanIds:['loan'],completedAt:10};
 validatePartyFormationReceipt(currentReceiptFixture,'request','ADD');
 assert.throws(()=>validatePartyFormationReceipt(currentReceiptFixture,'other','ADD'));
 assert.throws(()=>validatePartyFormationReceipt({...currentReceiptFixture,loanIds:[]},'request','ADD'));
 validatePartyFormationReceipt({...currentReceiptFixture,action:'REMOVE',loanIds:[]},'request','REMOVE','loan');
 assert.throws(()=>validatePartyFormationReceipt({...currentReceiptFixture,action:'REMOVE'},'request','REMOVE','loan'));
});

test('길드 후보를 이전 유저 목록과 구분하고 잘못된 계약을 거절한다',()=>{
 const currentGuildCandidate={characterId:'guild:novice',name:'초보 길드원',source:'GUILD',status:'AVAILABLE',cpEligible:true,remainingBorrowerSlots:1,costP:0,contractDays:7};
 const currentPageFixture={cityId:'iseulon',characterVersion:1,serverTime:10,nextCursor:null,entries:[],guildEntries:[currentGuildCandidate]};
 assert.equal(parsePartyCandidatePage(currentPageFixture,'iseulon').entries[0].source,'GUILD');
 assert.equal(currentPageFixture.entries.length,0);
 assert.throws(()=>parsePartyCandidatePage({...currentPageFixture,guildEntries:[{...currentGuildCandidate,costP:1}]},'iseulon'));
 assert.throws(()=>parsePartyCandidatePage({...currentPageFixture,guildEntries:[{...currentGuildCandidate,characterId:'guild:unknown'}]},'iseulon'));
 assert.throws(()=>parsePartyCandidatePage({...currentPageFixture,guildEntries:[currentGuildCandidate,currentGuildCandidate]},'iseulon'));
});
