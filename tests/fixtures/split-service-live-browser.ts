import {Client} from '../../src/client/api';
const currentTestContext=(globalThis as any).__SLIME_SPLIT_CONTEXT__;
const currentOriginalFetch=window.fetch.bind(window);
const currentRequestRecords:{origin:string;path:string}[]=[];
const currentGameClient=new Client();
let currentSocketConnected=false;
currentGameClient.onStatus=currentReadyStatus=>{currentSocketConnected=currentReadyStatus;};
window.fetch=async(currentRequestInput,currentRequestOptions)=>{
 const currentRequestAddress=new URL(String(currentRequestInput),location.href);
 if(currentRequestAddress.pathname.startsWith('/v1/'))currentRequestRecords.push({origin:currentRequestAddress.origin,path:currentRequestAddress.pathname});
 return currentOriginalFetch(currentRequestInput,currentRequestOptions);
};
function assertBrowserCondition(currentCondition:unknown,currentFailureMessage:string){if(!currentCondition)throw new Error(currentFailureMessage);}
async function waitSocketConnection(){
 const currentDeadlineTime=performance.now()+10000;
 while(!currentSocketConnected&&performance.now()<currentDeadlineTime)await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,50));
 assertBrowserCondition(currentSocketConnected,'게임 WebSocket 연결 실패');
}
(async()=>{try{
 const currentCredentialsRecord={user_id:'splitbrowserhero',password:currentTestContext.password};
 if(currentTestContext.rejectOrigin){
  let currentCorsRejected=false;
  try{await currentGameClient.request('/v1/auth/register',currentCredentialsRecord);}catch(currentFailureError){currentCorsRejected=currentFailureError instanceof TypeError;}
  assertBrowserCondition(currentCorsRejected,'허용되지 않은 origin의 JSON 가입 요청이 차단되지 않았습니다.');
 }else{
  await currentGameClient.request('/v1/auth/register',currentCredentialsRecord);
  assertBrowserCondition(await currentGameClient.login(currentCredentialsRecord.user_id,currentCredentialsRecord.password),'로그인 실패');
  await waitSocketConnection();
  await currentGameClient.command('/v1/characters/me',{character_name:'분리브라우저모험가'});
  await currentGameClient.command('/v1/world/enter');
  const currentCharacterBefore=structuredClone(currentGameClient.state!.me);
  const currentGenerationBefore=currentGameClient.state!.generation;
  assertBrowserCondition(currentCharacterBefore.guildMembership?.certificateStatus==='ISSUED','기본 길드 자격증 누락');
  await currentGameClient.request('/v1/sessions/heartbeat',{});
  currentGameClient.tokens=await currentGameClient.request('/v1/auth/refresh',{refresh_token:currentGameClient.tokens!.refresh_token});
  const currentPreviousToken=currentGameClient.tokens!.access_token;
  assertBrowserCondition(await currentGameClient.logout(),'로그아웃 실패');
  const currentRevokedResponse=await fetch(currentTestContext.gameOrigin+'/v1/game/state',{headers:{Authorization:'Bearer '+currentPreviousToken},redirect:'error'});
  assertBrowserCondition(currentRevokedResponse.status===401,'로그아웃한 토큰 재사용');
  assertBrowserCondition(await currentGameClient.login(currentCredentialsRecord.user_id,currentCredentialsRecord.password),'재로그인 실패');
  await waitSocketConnection();
  assertBrowserCondition(currentGameClient.state!.generation===currentGenerationBefore+2,'세대 전환 누락');
  for(const currentFieldName of ['id','name','coins','cp','sp','materials','skills','guildMembership'] as const)
   assertBrowserCondition(JSON.stringify(currentGameClient.state!.me[currentFieldName])===JSON.stringify(currentCharacterBefore[currentFieldName]),'캐릭터 보존 실패: '+currentFieldName);
  assertBrowserCondition(!JSON.stringify(currentGameClient.state).includes('priceIndexBasisPoints'),'내부 물가지수 노출');
 }
 for(const currentRequestRecord of currentRequestRecords)
  assertBrowserCondition(currentRequestRecord.origin===(currentRequestRecord.path.startsWith('/v1/auth/')?currentTestContext.identityOrigin:currentTestContext.gameOrigin),'요청 대상 불일치');
 currentGameClient.disconnect();
 await currentOriginalFetch('/test-result',{method:'POST',body:JSON.stringify({status:'PASS',requestCount:currentRequestRecords.length})});
}catch(currentFailureError){currentGameClient.disconnect();await currentOriginalFetch('/test-result',{method:'POST',body:JSON.stringify({status:'FAIL',message:String(currentFailureError)})});}})();
