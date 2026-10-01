import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const CURRENT_BROWSER_PATH=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const CURRENT_RUN_TIMESTAMP=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const CURRENT_OUTPUT_ROOT=resolve('.tmp/test/sponsor-sdk-loader',CURRENT_RUN_TIMESTAMP);
test('Chrome SRI가 변조 SDK 실행을 차단하고 정상 SDK를 한 번만 로드한다',async()=>{
 await mkdir(CURRENT_OUTPUT_ROOT,{recursive:true});
 const currentHeartbeatTimer=setInterval(()=>console.log(new Date().toISOString()+'/test/sdk-loader 실제 브라우저 대기'),5000);
 const currentKeyPair=generateKeyPairSync('ed25519');
 const currentPublicBytes=currentKeyPair.publicKey.export({format:'der',type:'spki'}).subarray(-32);
 const currentSdkSource="globalThis.sdkExecutionCount=(globalThis.sdkExecutionCount||0)+1;Object.defineProperty(globalThis,'SlimeCostumeSponsorSdk',{value:Object.freeze({version:1,mount(){return {destroy(){}};}})});";
 const currentSdkDigest=createHash('sha256').update(currentSdkSource).digest();
 const currentPayloadBytes=Buffer.from(JSON.stringify({purpose:'slime-sponsor-sdk',issuedAt:100,expiresAt:400,sdkVersion:1,sdkUrl:'/v1/sponsorship/sdk/1/'+currentSdkDigest.toString('hex')+'/costume.js',sdkIntegrity:'sha256-'+currentSdkDigest.toString('base64')}));
 const currentSignedEnvelope={algorithm:'Ed25519',keyId:createHash('sha256').update(currentPublicBytes).digest('hex'),publicKey:currentPublicBytes.toString('base64'),payload:currentPayloadBytes.toString('base64'),signature:sign(null,currentPayloadBytes,currentKeyPair.privateKey).toString('base64')};
 const currentScenarioSource=`import {loadSignedSponsorSdk} from './src/client/sponsor-sdk-loader.mjs';
const currentEnvelopeRecord=${JSON.stringify(currentSignedEnvelope)};
(async()=>{try{
 let currentRejectedFlag=false;
 try{await loadSignedSponsorSdk(currentEnvelopeRecord,currentEnvelopeRecord.publicKey,100);}catch{currentRejectedFlag=true;}
 if(!currentRejectedFlag||globalThis.tamperedSdkExecuted||globalThis.sdkExecutionCount)throw new Error('SRI 변조 차단 실패');
 const currentLoadedModules=await Promise.all([loadSignedSponsorSdk(currentEnvelopeRecord,currentEnvelopeRecord.publicKey,100),loadSignedSponsorSdk(currentEnvelopeRecord,currentEnvelopeRecord.publicKey,100)]);
 if(currentLoadedModules[0]!==currentLoadedModules[1]||globalThis.sdkExecutionCount!==1)throw new Error('SDK 중복 실행');
 await loadSignedSponsorSdk(currentEnvelopeRecord,currentEnvelopeRecord.publicKey,100);
 if(globalThis.sdkExecutionCount!==1||document.querySelectorAll('script[integrity]').length)throw new Error('SDK 캐시·정리 실패');
 let currentExpiredRejected=false;
 try{await loadSignedSponsorSdk(currentEnvelopeRecord,currentEnvelopeRecord.publicKey,400);}catch{currentExpiredRejected=true;}
 if(!currentExpiredRejected)throw new Error('캐시된 SDK가 만료 서명을 우회');
 await fetch('/result',{method:'POST',body:'PASS'});
}catch(currentFailureError){await fetch('/result',{method:'POST',body:'FAIL: '+String(currentFailureError)});}})();`;
 let currentBrowserProcess;
 let currentHttpServer;
 let currentResultTimeout;
 let currentSdkRequestCount=0;
 let currentResultResolver;
 const currentBrowserResult=new Promise((resolveBrowserResult,rejectBrowserResult)=>{currentResultResolver=resolveBrowserResult;currentResultTimeout=setTimeout(()=>rejectBrowserResult(new Error('브라우저 SDK 검사 시간 초과')),20000);});
 try{
  const currentBundleResult=await build({stdin:{contents:currentScenarioSource,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,platform:'browser',format:'iife'});
  currentHttpServer=createServer(async(currentRequest,currentResponse)=>{
   if(currentRequest.url==='/result') {let currentResultBody='';for await(const currentBodyChunk of currentRequest)currentResultBody+=currentBodyChunk;currentResponse.end('ok');currentResultResolver(currentResultBody);return;}
   if(currentRequest.url==='/bundle.js'){currentResponse.setHeader('Content-Type','text/javascript');currentResponse.end(currentBundleResult.outputFiles[0].text);return;}
   if(currentRequest.url.startsWith('/v1/sponsorship/sdk/')){currentSdkRequestCount++;currentResponse.setHeader('Content-Type','text/javascript');currentResponse.setHeader('Cache-Control','no-store');currentResponse.end(currentSdkRequestCount===1?'globalThis.tamperedSdkExecuted=true;':currentSdkSource);return;}
   currentResponse.setHeader('Content-Type','text/html');currentResponse.end('<!doctype html><meta charset="utf-8"><script src="/bundle.js"></script>');
  });
  await new Promise(currentListenResolver=>currentHttpServer.listen(0,'127.0.0.1',currentListenResolver));
  let currentBrowserLog='';
  currentBrowserProcess=spawn(CURRENT_BROWSER_PATH,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',`--user-data-dir=${CURRENT_OUTPUT_ROOT}/profile`,`http://127.0.0.1:${currentHttpServer.address().port}/`],{stdio:['ignore','ignore','pipe']});
  currentBrowserProcess.stderr.on('data',currentLogChunk=>{currentBrowserLog+=currentLogChunk;});
  const currentResultText=await currentBrowserResult;
  await writeFile(`${CURRENT_OUTPUT_ROOT}/chrome.log`,currentBrowserLog);
  await writeFile(`${CURRENT_OUTPUT_ROOT}/result.txt`,currentResultText);
  assert.equal(currentResultText,'PASS');assert.equal(currentSdkRequestCount,2);
 }finally{
  clearTimeout(currentResultTimeout);clearInterval(currentHeartbeatTimer);
  if(currentBrowserProcess&&currentBrowserProcess.exitCode===null){currentBrowserProcess.kill();await new Promise(currentExitResolver=>currentBrowserProcess.once('exit',currentExitResolver));}
  if(currentHttpServer){currentHttpServer.closeAllConnections();await new Promise(currentCloseResolver=>currentHttpServer.close(currentCloseResolver));}
  console.log('SDK 로드 브라우저 기록: '+CURRENT_OUTPUT_ROOT);
 }
});
