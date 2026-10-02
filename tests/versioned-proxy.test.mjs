import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createViteServer,loadConfigFromFile} from 'vite';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

async function verifyVersionedHttpRequests(currentProxyOrigin){
 for(const currentApiVersion of ['v1','v2']){
  const currentRequestPath=`/${currentApiVersion}/probe?cursor=sample&limit=2`;
  const currentProxyResponse=await fetch(currentProxyOrigin+currentRequestPath,{method:'POST',body:'{}',signal:AbortSignal.timeout(5000)});
  assert.equal(currentProxyResponse.status,200);
  assert.deepEqual(await currentProxyResponse.json(),{path:currentRequestPath,method:'POST'});
 }
 const currentCatalogResponse=await fetch(currentProxyOrigin+'/v2/costumes',{signal:AbortSignal.timeout(5000)});
 assert.equal(currentCatalogResponse.status,200);
 assert.deepEqual(await currentCatalogResponse.json(),{path:'/v2/costumes',method:'GET'});
 const currentFailureResponse=await fetch(currentProxyOrigin+'/v2/fail',{signal:AbortSignal.timeout(5000)});
 assert.equal(currentFailureResponse.status,409);
 assert.deepEqual(await currentFailureResponse.json(),{code:'RULE_TEST'});
}

test('Vite는 v1·v2의 경로·쿼리·메서드·실패 응답을 API에 전달한다',async()=>{
 const currentBackendServer=createHttpServer((currentRequest,currentResponse)=>{
  currentRequest.resume();currentResponse.setHeader('content-type','application/json');
  currentResponse.statusCode=currentRequest.url==='/v2/fail'?409:200;
  currentResponse.end(JSON.stringify(currentResponse.statusCode===409?{code:'RULE_TEST'}:{path:currentRequest.url,method:currentRequest.method}));
 });
 await new Promise(currentResolveCallback=>currentBackendServer.listen(0,'127.0.0.1',currentResolveCallback));
 let currentViteServer;
 try{
  const currentLoadedConfig=await loadConfigFromFile({command:'serve',mode:'test'},resolve('vite.config.ts'));
  const currentBackendOrigin=`http://127.0.0.1:${currentBackendServer.address().port}`;
  const currentProxyConfiguration=Object.fromEntries(Object.entries(currentLoadedConfig.config.server.proxy).map(([currentPathPattern,currentProxyOptions])=>
   [currentPathPattern,typeof currentProxyOptions==='string'?currentBackendOrigin:{...currentProxyOptions,target:currentBackendOrigin}]));
  currentViteServer=await createViteServer({...currentLoadedConfig.config,configFile:false,logLevel:'silent',
   server:{...currentLoadedConfig.config.server,host:'127.0.0.1',port:0,strictPort:false,watch:null,proxy:currentProxyConfiguration}});
  await currentViteServer.listen();
  await verifyVersionedHttpRequests(`http://127.0.0.1:${currentViteServer.httpServer.address().port}`);
 }finally{
  await currentViteServer?.close();
  await new Promise(currentResolveCallback=>currentBackendServer.close(currentResolveCallback));
 }
});

const CURRENT_NGINX_TEST_IMAGE=process.env.SLIME_NGINX_TEST_IMAGE;
test('실제 nginx 컨테이너는 v1·v2 API를 SPA와 구분해 전달한다',{skip:!CURRENT_NGINX_TEST_IMAGE},async()=>{
 const currentTestIdentifier='slime-proxy-'+randomUUID();
 const currentBackendName=currentTestIdentifier+'-api';
 const currentFrontendName=currentTestIdentifier+'-web';
 const currentTimestampName=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,19).replace('T','_').replaceAll(':','-');
 const currentOutputDirectory=resolve('.tmp/test/versioned-proxy',currentTimestampName,currentTestIdentifier);
 await mkdir(currentOutputDirectory,{recursive:true});
 const currentBackendConfig=resolve(currentOutputDirectory,'backend.conf');
 await writeFile(currentBackendConfig,`server { listen 18080; default_type application/json; location = /v2/fail { return 409 '{"code":"RULE_TEST"}'; } location / { return 200 '{"path":"$request_uri","method":"$request_method"}'; } }`);
 const currentCreatedContainers=[];
 const currentDockerCommand=(currentArguments)=>execFileSync('docker',currentArguments,{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
 currentDockerCommand(['network','create',currentTestIdentifier]);
 try{
  for(const [currentContainerName,currentConfigPath,currentRunOptions] of [
   [currentBackendName,currentBackendConfig,['--network-alias','api']],
   [currentFrontendName,resolve('nginx.conf'),['-p','127.0.0.1::8080']]]){
   currentDockerCommand(['run','-d','--name',currentContainerName,'--network',currentTestIdentifier,
    ...currentRunOptions,'--mount',`type=bind,src=${currentConfigPath},dst=/etc/nginx/conf.d/default.conf,readonly`,CURRENT_NGINX_TEST_IMAGE]);
   currentCreatedContainers.push(currentContainerName);
  }
  const currentPublishedPort=currentDockerCommand(['port',currentFrontendName,'8080/tcp']).trim().split(':').at(-1);
  const currentProxyOrigin='http://127.0.0.1:'+currentPublishedPort;
  const currentStartupDeadline=Date.now()+10000;
  while(true){
   try{if((await fetch(currentProxyOrigin,{signal:AbortSignal.timeout(500)})).ok)break;}catch{}
   if(Date.now()>currentStartupDeadline)throw new Error('nginx 테스트 서버 시작 시간 초과');
   await new Promise(currentResolveCallback=>setTimeout(currentResolveCallback,100));
  }
  await verifyVersionedHttpRequests(currentProxyOrigin);
 }finally{
  for(const currentContainerName of currentCreatedContainers.reverse()){
   await writeFile(resolve(currentOutputDirectory,currentContainerName+'.log'),currentDockerCommand(['logs',currentContainerName]));
   currentDockerCommand(['rm','-f',currentContainerName]);
  }
  currentDockerCommand(['network','rm',currentTestIdentifier]);
 }
});
