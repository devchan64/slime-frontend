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

const BORROWED_TEST_LOAN_ID='12345678-1234-1234-1234-123456789abc';
test('편성 해제 응답 유실 후 동일 본문으로 복구하고 계약 유지를 안내한다',async()=>{
 const {currentTextClient}=createParticipationClient(PARTICIPATION_TEST_RESPONSE);
 const currentRequestBodies=[];
 currentTextClient.fetcher=async(currentRequestUrl,currentRequestOptions)=>{
  assert.equal(currentRequestUrl,'http://localhost/v1/game/borrowed-party/'+BORROWED_TEST_LOAN_ID+'/remove');
  const currentRequestBody=JSON.parse(currentRequestOptions.body);
  currentRequestBodies.push(currentRequestBody);
  if(currentRequestBodies.length<3)throw new TypeError('응답 유실');
  return Response.json({receipt:{requestId:currentRequestBody.requestId,loanId:BORROWED_TEST_LOAN_ID,
   action:'REMOVE',loanIds:[],completedAt:100},state:{...currentTextClient.state,cursor:1,me:{...currentTextClient.state.me,version:2}}});
 };
 await assert.rejects(currentTextClient.execute('loans remove '+BORROWED_TEST_LOAN_ID),/retry/);
 await assert.rejects(currentTextClient.execute('loans remove '+BORROWED_TEST_LOAN_ID),/retry/);
 const currentResultText=await currentTextClient.execute('retry');
 assert.match(currentResultText,/기존 대여 계약은 유지/);
 assert.equal(currentTextClient.state.me.version,2);
 assert.deepEqual(currentRequestBodies[0],currentRequestBodies[1]);
 assert.deepEqual(currentRequestBodies[0],currentRequestBodies[2]);
});
test('편성 해제 입력·전투 상태와 다른 대여의 영수증을 거절한다',async()=>{
 const {currentTextClient,currentRequestCalls}=createParticipationClient({});
 for(const currentCommandText of ['loans remove','loans remove invalid','loans remove '+BORROWED_TEST_LOAN_ID+' extra'])
  await assert.rejects(currentTextClient.execute(currentCommandText));
 currentTextClient.state.battle={id:'battle'};
 await assert.rejects(currentTextClient.execute('loans remove '+BORROWED_TEST_LOAN_ID),/전투/);
 assert.equal(currentRequestCalls.length,0);
 currentTextClient.state.battle=null;
 currentTextClient.fetcher=async(currentRequestUrl,currentRequestOptions)=>Response.json({
  receipt:{requestId:JSON.parse(currentRequestOptions.body).requestId,loanId:'other',action:'REMOVE',loanIds:[],completedAt:100},
  state:{...currentTextClient.state,me:{...currentTextClient.state.me,version:2}},
 });
 await assert.rejects(currentTextClient.execute('loans remove '+BORROWED_TEST_LOAN_ID),/retry/);
 assert.equal(currentTextClient.state.me.version,1);
 assert.ok(currentTextClient.pendingCommandRequest);
});
