import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const PARTICIPATION_TEST_RESPONSE={serverTime:100,participants:[{loanId:'one',name:'아린'}],
 excluded:[{loanId:'two',name:'보라',reason:'RECOVERY_PENDING'}]};
function createParticipationClient(currentResponseRecord){
 const currentRequestCalls=[];
 const currentTextClient=new TextClient('http://localhost',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestCalls.push({url:currentRequestUrl,method:currentRequestOptions.method});
  return Response.json(currentResponseRecord);
 }});
 currentTextClient.tokens={user_id:'owner',access_token:'token'};
 currentTextClient.accept({protocolVersion:1,generation:1,epoch:1,cursor:0,me:{id:'owner',version:1,mode:'FIELD'}});
 return {currentTextClient,currentRequestCalls};
}
test('대여 참가 명령은 조회만 수행하며 참가 예상과 제외 이유를 구분한다',async()=>{
 const {currentTextClient,currentRequestCalls}=createParticipationClient(PARTICIPATION_TEST_RESPONSE);
 const currentOriginalState=structuredClone(currentTextClient.state);
 const currentOutputText=await currentTextClient.execute('loans participation');
 assert.match(currentOutputText,/참가 가능: 아린 \[one\]/);
 assert.match(currentOutputText,/제외: 보라 \[two\] · 회복 대기/);
 assert.match(currentOutputText,/실제 전투 시작 시/);
 assert.deepEqual(currentRequestCalls,[{url:'http://localhost/v1/game/borrowed-party/participation',method:'GET'}]);
 assert.deepEqual(currentTextClient.state,currentOriginalState);
 await assert.rejects(currentTextClient.execute('loans participation extra'));
 assert.equal(currentRequestCalls.length,1);
});
test('빈 편성은 성공적인 빈 조회로 표시하고 중복 명단은 거절한다',async()=>{
 const {currentTextClient}=createParticipationClient({serverTime:100,participants:[],excluded:[]});
 assert.match(await currentTextClient.execute('loans participation'),/편성된 대여 파티원이 없습니다/);
 const {currentTextClient:currentInvalidClient}=createParticipationClient({...PARTICIPATION_TEST_RESPONSE,
  excluded:[{loanId:'one',name:'중복',reason:'EXPIRED'}]});
 await assert.rejects(currentInvalidClient.execute('loans participation'),/중복/);
});
test('조회 중 버전이 바뀌면 이전 참가 명단을 표시하지 않는다',async()=>{
 const {currentTextClient}=createParticipationClient(PARTICIPATION_TEST_RESPONSE);
 currentTextClient.request=async()=>{currentTextClient.state.me.version++;return PARTICIPATION_TEST_RESPONSE;};
 await assert.rejects(currentTextClient.execute('loans participation'),/상태가 변경/);
});
