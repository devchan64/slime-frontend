import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createSessionState(currentCharacterIdentifier,currentSessionGeneration){
 return {protocolVersion:1,generation:currentSessionGeneration,epoch:1,cursor:0,me:{id:currentCharacterIdentifier,version:1,mode:'FIELD'}};
}
for(const currentResponseMode of ['success','network','rejection']){
 test(`이전 세션의 ${currentResponseMode} 응답은 새 세션에 반영하거나 재전송하지 않는다`,async()=>{
  let resolvePendingResponse;
  let rejectPendingResponse;
  let currentRequestCount=0;
  const currentDelayedResponse=new Promise((currentResolveCallback,currentRejectCallback)=>{
   resolvePendingResponse=currentResolveCallback;rejectPendingResponse=currentRejectCallback;
  });
  const currentTextClient=new TextClient('http://localhost',{fetcher:async()=>{currentRequestCount++;return currentDelayedResponse;}});
  currentTextClient.tokens={user_id:'first',access_token:'first-token'};
  currentTextClient.accept(createSessionState('first',1));
  const currentOldCommand=currentTextClient.command('/v1/game/move',{position:{column:1,row:1}});
  currentTextClient.tokens={user_id:'second',access_token:'second-token'};
  currentTextClient.state=createSessionState('second',2);
  const currentNewPending={path:'/new-session-request'};
  currentTextClient.pendingCommandRequest=currentNewPending;
  if(currentResponseMode==='network')rejectPendingResponse(new TypeError('응답 유실'));
  else if(currentResponseMode==='rejection')resolvePendingResponse(Response.json({code:'STATE_CHANGED',message:'상태 변경'},{status:409}));
  else resolvePendingResponse(Response.json({state:createSessionState('first',99)}));
  await assert.rejects(currentOldCommand,/계정·캐릭터·세션/);
  assert.equal(currentRequestCount,1);
  assert.equal(currentTextClient.state.me.id,'second');
  assert.equal(currentTextClient.state.generation,2);
  assert.equal(currentTextClient.pendingCommandRequest,currentNewPending);
 });
}


test('다른 계정으로 로그인하면 이전 계정의 높은 세대와 상태를 비교하지 않는다',async()=>{
 const currentResponses=[{user_id:'second',access_token:'second-token',refresh_token:'second-refresh'},
  createSessionState('second',1)];
 const currentTextClient=new TextClient('http://localhost',{fetcher:async()=>Response.json(currentResponses.shift())});
 currentTextClient.tokens={user_id:'first',access_token:'first-token',refresh_token:'first-refresh'};
 currentTextClient.accept(createSessionState('first',99));
 await currentTextClient.login('second','test-password');
 assert.equal(currentTextClient.state.me.id,'second');
 assert.equal(currentTextClient.state.generation,1);
});

for(const currentSessionChange of ['login','logout']){
 test(`이전 상태 조회 응답은 ${currentSessionChange} 이후 상태를 덮어쓰지 않는다`,async()=>{
  let resolveSnapshotResponse;
  const currentDelayedResponse=new Promise(currentResolveCallback=>{resolveSnapshotResponse=currentResolveCallback;});
  const currentTextClient=new TextClient('http://localhost',{fetcher:async()=>currentDelayedResponse});
  currentTextClient.tokens={user_id:'first',access_token:'first-token'};
  currentTextClient.accept(createSessionState('first',1));
  const currentPendingSnapshot=currentTextClient.snapshot();
  currentTextClient.tokens=currentSessionChange==='login'?{user_id:'second',access_token:'second-token'}:null;
  currentTextClient.state=currentSessionChange==='login'?createSessionState('second',1):null;
  const currentExpectedState=currentTextClient.state;
  resolveSnapshotResponse(Response.json(createSessionState('first',99)));
  await assert.rejects(currentPendingSnapshot,/로그인 정보가 변경/);
  assert.equal(currentTextClient.state,currentExpectedState);
 });
}

test('다른 캐릭터의 상태 조회 응답은 현재 상태를 보존한다',async()=>{
 const currentTextClient=new TextClient('http://localhost',{fetcher:async()=>Response.json(createSessionState('other',99))});
 currentTextClient.tokens={user_id:'first',access_token:'first-token'};
 const currentExpectedState=createSessionState('first',1);
 currentTextClient.accept(currentExpectedState);
 await assert.rejects(currentTextClient.snapshot(),/캐릭터/);
 assert.equal(currentTextClient.state,currentExpectedState);
});


for(const currentAuthenticationAction of ['login','refresh','logout']){
 test(`늦은 ${currentAuthenticationAction} 응답은 새 로그인·상태·대기 명령을 보존한다`,async()=>{
  let resolveAuthenticationResponse;
  const currentDelayedResponse=new Promise(currentResolveCallback=>{resolveAuthenticationResponse=currentResolveCallback;});
  let currentRequestCount=0;
  const currentTextClient=new TextClient('http://localhost',{fetcher:async()=>{currentRequestCount++;return currentDelayedResponse;}});
  currentTextClient.tokens={user_id:'first',access_token:'first-token',refresh_token:'first-refresh'};
  currentTextClient.accept(createSessionState('first',1));
  const currentPendingAuthentication=currentTextClient[currentAuthenticationAction]('first','test-password');
  const currentNewTokens={user_id:'second',access_token:'second-token',refresh_token:'second-refresh'};
  const currentNewState=createSessionState('second',1);
  const currentNewCommand={path:'/new-request'};
  currentTextClient.tokens=currentNewTokens;
  currentTextClient.state=currentNewState;
  currentTextClient.pendingCommandRequest=currentNewCommand;
  resolveAuthenticationResponse(Response.json(currentAuthenticationAction==='logout'?{}:
   {user_id:'first',access_token:'old-renewed',refresh_token:'old-refresh'}));
  await assert.rejects(currentPendingAuthentication,/로그인 정보가 변경/);
  assert.equal(currentTextClient.tokens,currentNewTokens);
  assert.equal(currentTextClient.state,currentNewState);
  assert.equal(currentTextClient.pendingCommandRequest,currentNewCommand);
  assert.equal(currentRequestCount,1);
 });
}

test('세션 전환 대기 중 계정이 바뀌면 새 토큰으로 이전 작업을 조회하지 않는다',async()=>{
 let resolveTransitionSleep;
 const currentTextClient=new TextClient('http://localhost',{
  sleep:()=>new Promise(currentResolveCallback=>{resolveTransitionSleep=currentResolveCallback;}),
  fetcher:async()=>{throw new Error('이전 작업을 전송하면 안 됩니다.');},
 });
 currentTextClient.tokens={user_id:'first',access_token:'first-token'};
 const currentPendingTransition=currentTextClient.resolve({pending:true,operationId:'old-operation',receipt:'old-receipt'});
 currentTextClient.tokens={user_id:'second',access_token:'second-token'};
 resolveTransitionSleep();
 await assert.rejects(currentPendingTransition,/로그인 정보가 변경/);
});
