import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const TEST_PARTY_INVITATION='11111111-1111-4111-8111-111111111111';
function createPartyTestClient(){
 const currentTextClient=new TextClient('http://localhost',{sleep:async()=>{}});
 currentTextClient.tokens={user_id:'owner',access_token:'token'};
 currentTextClient.accept({protocolVersion:1,generation:1,epoch:1,cursor:0,me:{id:'owner',version:1,mode:'FIELD',position:{column:1,row:1},citizenshipSummary:{records:[{cityId:'iseulon',status:'VALID'}]}},
  map:{id:'iseulon',buildings:[{facilityKind:'guild',entrance:{column:1,row:1}}]},party:null,invitations:[],members:[{id:'guest',name:'손님',mode:'FIELD',partyCpEligible:true}]});
 return currentTextClient;
}
function createPartyCommandResponse(currentTextClient,currentPartyRecord){return {state:{...currentTextClient.state,cursor:currentTextClient.state.cursor+1,me:{...currentTextClient.state.me,version:currentTextClient.state.me.version+1},party:currentPartyRecord}};}
test('온라인 파티 생성·초대·추방·해산은 공통 버전 명령으로 연결한다',async()=>{
 const currentTextClient=createPartyTestClient();const currentCommandRequests=[];
 currentTextClient.request=async(currentPath,currentBody)=>{
  assert.equal(currentPath,'/v1/game/party/commands');currentCommandRequests.push(currentBody);
  return createPartyCommandResponse(currentTextClient,currentBody.action==='DISBAND'?null:{id:'party',leader:'owner',members:currentBody.action==='INVITE'?['owner','guest']:['owner']});
 };
 await currentTextClient.execute('party create');await currentTextClient.execute('party invite guest');
 await currentTextClient.execute('party kick guest');await currentTextClient.execute('party disband');
 assert.deepEqual(currentCommandRequests.map(currentRequest=>currentRequest.action),['CREATE','INVITE','KICK','DISBAND']);
 assert.deepEqual(currentCommandRequests.map(currentRequest=>currentRequest.expectedVersion),[1,2,3,4]);
 assert.equal(new Set(currentCommandRequests.map(currentRequest=>currentRequest.requestId)).size,4);
 assert.equal(currentCommandRequests[1].targetId,'guest');assert.equal(currentTextClient.state.party,null);
});
test('초대 목록을 조회하고 수락·탈퇴하며 출력 제어 문자를 제거한다',async()=>{
 const currentTextClient=createPartyTestClient();currentTextClient.state.invitations=[{id:TEST_PARTY_INVITATION,from:'guest',partyCpEligible:true}];
 currentTextClient.state.members[0].name='손님\x1b[31m';const currentCommandRequests=[];
 currentTextClient.request=async(currentPath,currentBody)=>{
  if(!currentBody)return {...currentTextClient.state,cursor:currentTextClient.state.cursor+1};
  currentCommandRequests.push(currentBody);return createPartyCommandResponse(currentTextClient,currentBody.action==='LEAVE'?null:{id:'party',leader:'guest',members:['guest','owner']});
 };
 const currentPartyOutput=await currentTextClient.execute('party list');assert.match(currentPartyOutput,/party accept/);assert.doesNotMatch(currentPartyOutput,/\x1b/);
 await currentTextClient.execute('party accept '+TEST_PARTY_INVITATION);await currentTextClient.execute('party leave');
 assert.equal(currentCommandRequests[0].invitationId,TEST_PARTY_INVITATION);assert.equal(currentCommandRequests[1].action,'LEAVE');
});
test('응답 유실은 같은 본문으로 복구하고 확인 전 다른 변경을 차단한다',async()=>{
 const currentTextClient=createPartyTestClient();const currentCommandRequests=[];
 currentTextClient.request=async(currentPath,currentBody)=>{
  if(!currentBody)return {...currentTextClient.state,cursor:currentTextClient.state.cursor+1};
  currentCommandRequests.push(currentBody);if(currentCommandRequests.length<3)throw new TypeError('응답 유실');
  return createPartyCommandResponse(currentTextClient,{id:'party',leader:'owner',members:['owner']});
 };
 await assert.rejects(currentTextClient.execute('party create'),/retry/);
 await assert.rejects(currentTextClient.execute('party leave'),/retry/);
 await currentTextClient.execute('party list');await currentTextClient.execute('retry');
 assert.equal(currentCommandRequests.length,3);assert.deepEqual(currentCommandRequests[0],currentCommandRequests[2]);
 assert.equal(currentTextClient.state.party.leader,'owner');
});
test('잘못된 인수·장소·대여 편성·초대·권한은 전송 전 거절한다',async()=>{
 const currentTextClient=createPartyTestClient();let currentRequestCount=0;
 currentTextClient.request=async()=>{currentRequestCount++;throw new Error('전송하면 안 됨');};
 for(const currentCommand of ['party','party create extra','party toString','party accept bad','party invite guest','party kick guest','party disband'])await assert.rejects(currentTextClient.execute(currentCommand));
 currentTextClient.state.me.position.column=2;await assert.rejects(currentTextClient.execute('party create'),/길드/);
 currentTextClient.state.me.position.column=1;currentTextClient.state.me.borrowedPartyLoanIds=['loan'];await assert.rejects(currentTextClient.execute('party create'),/대여/);
 currentTextClient.state.me.borrowedPartyLoanIds=[];await assert.rejects(currentTextClient.execute('party accept '+TEST_PARTY_INVITATION),/초대/);
 assert.equal(currentRequestCount,0);
});
