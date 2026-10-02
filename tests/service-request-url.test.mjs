import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {createServiceRequestResolver} from '../src/client/service-request-url.mjs';
import {TextClient} from '../scripts/text-client-core.mjs';

test('인증 주소 미설정은 기존 API 주소이며 별도 주소는 명시한 인증 경로에만 사용한다',()=>{
 const currentDefaultResolver=createServiceRequestResolver('/gateway');
 assert.equal(currentDefaultResolver('/v1/auth/login'),'/gateway/v1/auth/login');
 const currentSplitResolver=createServiceRequestResolver('https://game.example','https://identity.example/base/');
 assert.equal(currentSplitResolver('/v1/auth/operations/receipt/resolve'),'https://identity.example/base/v1/auth/operations/receipt/resolve');
 for(const currentRequestPath of ['/v1/game/state','/v1/sessions/heartbeat','/v1/authentication','/v2/costumes'])
  assert.equal(currentSplitResolver(currentRequestPath),'https://game.example'+currentRequestPath);
 for(const currentInvalidAddress of ['', '/identity','ftp://identity.example','https://user:pass@identity.example','https://identity.example/?token=value','https://identity.example/#part'])
  assert.throws(()=>createServiceRequestResolver('',currentInvalidAddress));
});

test('실제 두 HTTP 서버에서 GUI와 텍스트의 인증 요청을 분리하고 장애 시 게임으로 재전송하지 않는다',async()=>{
 const currentReceivedRequests=[];
 async function startTestService(currentServiceName){
  const currentHttpServer=createServer((currentRequest,currentResponse)=>{
   currentReceivedRequests.push({service:currentServiceName,path:currentRequest.url});
   currentRequest.resume();
   currentResponse.setHeader('content-type','application/json');
   if(currentRequest.url.endsWith('/fail/resolve')){
    currentResponse.statusCode=503;
    currentResponse.end(JSON.stringify({code:'STORAGE_UNAVAILABLE',message:'검증용 인증 장애'}));
   }else currentResponse.end(JSON.stringify({ok:true}));
  });
  await new Promise(currentResolveCallback=>currentHttpServer.listen(0,'127.0.0.1',currentResolveCallback));
  return {server:currentHttpServer,origin:`http://127.0.0.1:${currentHttpServer.address().port}`};
 }
 const currentGameService=await startTestService('game');
 const currentIdentityService=await startTestService('identity');
 try{
  const currentBrowserBundle=await build({entryPoints:['src/client/api.ts'],bundle:true,write:false,format:'esm',platform:'node',
   define:{'import.meta.env':JSON.stringify({VITE_API_BASE_URL:currentGameService.origin,VITE_IDENTITY_API_BASE_URL:currentIdentityService.origin})},
   plugins:[{name:'locale-test',setup(currentBuildContext){
    currentBuildContext.onResolve({filter:/^\.\.\/i18n$/},()=>({path:'locale',namespace:'test'}));
    currentBuildContext.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const getLocale=()=>"ko";'}));
   }}]});
  const {Client}=await import(`data:text/javascript;base64,${Buffer.from(currentBrowserBundle.outputFiles[0].text).toString('base64')}`);
  for(const currentServiceClient of [new Client(),new TextClient(currentGameService.origin,{identityBaseUrl:currentIdentityService.origin})]){
   for(const currentAuthPath of ['register','login','refresh','logout','operations/receipt/resolve']){
    await currentServiceClient.request('/v1/auth/'+currentAuthPath,{});
    assert.deepEqual(currentReceivedRequests.at(-1),{service:'identity',path:'/v1/auth/'+currentAuthPath});
   }
   await currentServiceClient.request('/v1/characters/me',{});
   assert.deepEqual(currentReceivedRequests.at(-1),{service:'game',path:'/v1/characters/me'});
   await currentServiceClient.request('/v1/sessions/heartbeat',{});
   assert.deepEqual(currentReceivedRequests.at(-1),{service:'game',path:'/v1/sessions/heartbeat'});
   const currentRequestsBeforeFailure=currentReceivedRequests.length;
   await assert.rejects(currentServiceClient.request('/v1/auth/operations/fail/resolve',{}));
   assert.equal(currentReceivedRequests.length,currentRequestsBeforeFailure+1);
   assert.equal(currentReceivedRequests.at(-1).service,'identity');
  }
 }finally{
  await Promise.all([currentGameService,currentIdentityService].map(currentServiceRecord=>new Promise(currentResolveCallback=>currentServiceRecord.server.close(currentResolveCallback))));
 }
});
