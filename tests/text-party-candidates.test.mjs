import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createCandidateFixture(){
 const currentCandidate={characterId:'guild:novice',name:'초보 길드원',source:'GUILD',status:'AVAILABLE',cpEligible:true,remainingBorrowerSlots:1,costP:0,contractDays:7};
 const currentPage={cityId:'iseulon',characterVersion:1,serverTime:100,nextCursor:null,entries:[],guildEntries:[currentCandidate]};
 const currentTextClient=new TextClient('http://localhost');
 currentTextClient.tokens={user_id:'owner',access_token:'token'};
 currentTextClient.accept({protocolVersion:1,generation:1,epoch:1,cursor:0,location:{id:'iseulon'},
  map:{id:'iseulon',buildings:[{facilityId:'iseulon-guild',facilityKind:'guild',entrance:{column:1,row:1}}]},
  me:{id:'owner',version:1,mode:'FIELD',position:{column:1,row:1}}});
 currentTextClient.request=async()=>structuredClone(currentPage);
 return {currentTextClient,currentPage,currentCandidate};
}
test('길드 후보 조회 뒤 추가는 공용 명령과 영수증 검증으로 연결한다',async()=>{
 const {currentTextClient}=createCandidateFixture();
 assert.match(await currentTextClient.execute('loans candidates iseulon-guild'),/guild:novice.*무료 7일/);
 currentTextClient.request=async(currentRequestPath,currentRequestBody)=>{
  assert.equal(currentRequestPath,'/v1/game/guilds/iseulon-guild/party-members');
  assert.equal(currentRequestBody.characterId,'guild:novice');
  return {receipt:{requestId:currentRequestBody.requestId,action:'ADD',loanId:'loan',loanIds:['loan'],completedAt:100},
   state:{...currentTextClient.state,cursor:1,me:{...currentTextClient.state.me,version:2}}};
 };
 assert.match(await currentTextClient.execute('loans add iseulon-guild guild:novice'),/대여 편성 추가/);
 assert.equal(currentTextClient.partyCandidatePage,null);
});
test('미조회·오래된 조회·원격·조건 미달 후보는 전송하지 않는다',async()=>{
 const {currentTextClient,currentCandidate}=createCandidateFixture();
 await assert.rejects(currentTextClient.execute('loans add iseulon-guild guild:novice'),/먼저 조회/);
 await currentTextClient.execute('loans candidates iseulon-guild');
 currentTextClient.state.me.version++;
 await assert.rejects(currentTextClient.execute('loans add iseulon-guild guild:novice'),/먼저 조회/);
 currentTextClient.state.me.version--;
 currentTextClient.state.me.position.column=2;
 await assert.rejects(currentTextClient.execute('loans candidates iseulon-guild'),/입구/);
 currentTextClient.state.me.position.column=1;
 currentCandidate.cpEligible=false;currentCandidate.status='CP_OUT_OF_RANGE';
 await currentTextClient.execute('loans candidates iseulon-guild');
 await assert.rejects(currentTextClient.execute('loans add iseulon-guild guild:novice'),/조건/);
});
test('조회 중 변경과 잘못된 커서를 거절하고 미확정 명령 중 추가를 차단한다',async()=>{
 const {currentTextClient,currentPage}=createCandidateFixture();
 await assert.rejects(currentTextClient.execute('loans candidates iseulon-guild ../bad'));
 currentTextClient.request=async()=>{currentTextClient.state.me.version++;return currentPage;};
 await assert.rejects(currentTextClient.execute('loans candidates iseulon-guild'),/상태가 변경/);
 assert.equal(currentTextClient.partyCandidatePage,null);
 currentTextClient.pendingCommandRequest={};
 await assert.rejects(currentTextClient.execute('loans add iseulon-guild guild:novice'),/retry/);
});
