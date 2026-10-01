import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign,randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {resolve,isAbsolute} from 'node:path';
import {build} from 'esbuild';
const CURRENT_BROWSER_PATH=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const CURRENT_RUN_TIMESTAMP=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const CURRENT_OUTPUT_ROOT=resolve('.tmp/test/costume-sponsor-browser',CURRENT_RUN_TIMESTAMP);
const CURRENT_SDK_SOURCE_PATH=process.env.SLIME_SPONSOR_SDK_FILE;
test('Chrome에서 실제 SDK·서명·코스튬 UI의 표시와 정리를 검증한다',{skip:!CURRENT_SDK_SOURCE_PATH&&'SLIME_SPONSOR_SDK_FILE에 배포 SDK 절대 경로를 지정하세요.'},async()=>{
 assert.ok(isAbsolute(CURRENT_SDK_SOURCE_PATH));
 const currentSdkSource=await readFile(CURRENT_SDK_SOURCE_PATH);
 const currentSdkDigest=createHash('sha256').update(currentSdkSource).digest();
 const currentSdkIdentity={sdkVersion:1,sdkUrl:'/v1/sponsorship/sdk/1/'+currentSdkDigest.toString('hex')+'/costume.js',sdkIntegrity:'sha256-'+currentSdkDigest.toString('base64')};
 const currentSigningKeys=generateKeyPairSync('ed25519');
 const currentPublicBytes=currentSigningKeys.publicKey.export({format:'der',type:'spki'}).subarray(-32);
 function signBrowserPayload(currentPayloadRecord){const currentPayloadBytes=Buffer.from(JSON.stringify(currentPayloadRecord));return {algorithm:'Ed25519',keyId:createHash('sha256').update(currentPublicBytes).digest('hex'),publicKey:currentPublicBytes.toString('base64'),payload:currentPayloadBytes.toString('base64'),signature:sign(null,currentPayloadBytes,currentSigningKeys.privateKey).toString('base64')};}
 await mkdir(CURRENT_OUTPUT_ROOT,{recursive:true});
 const currentHeartbeatTimer=setInterval(()=>console.log(new Date().toISOString()+'/test/costume-sponsor 브라우저 표시·만료 검사 중'),5000);
 let currentBrowserProcess,currentHttpServer,currentResultTimeout,currentResultResolver,currentResultRejecter;
 let currentSdkRequestCount=0,currentBrowserLog='';
 const currentBrowserResult=new Promise((resolveBrowserResult,rejectBrowserResult)=>{currentResultResolver=resolveBrowserResult;currentResultRejecter=rejectBrowserResult;});
 try{
  const currentLocaleSources={};
  for(const currentLocaleName of ['ko','en'])for(const currentFileName of await readdir(`src/i18n/locales/${currentLocaleName}`))currentLocaleSources[`./locales/${currentLocaleName}/${currentFileName}`]=await readFile(`src/i18n/locales/${currentLocaleName}/${currentFileName}`,'utf8');
  const currentBundleResult=await build({entryPoints:['tests/fixtures/costume-sponsor-browser.tsx'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',jsxImportSource:'preact',define:{'import.meta.env.VITE_SPONSOR_PUBLIC_KEY':JSON.stringify(currentPublicBytes.toString('base64'))},plugins:[{name:'test-locales',setup(currentBuildContext){currentBuildContext.onLoad({filter:/\/i18n\/index\.ts$/},async({path:currentModulePath})=>({contents:(await readFile(currentModulePath,'utf8')).replace("import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })",JSON.stringify(currentLocaleSources)),loader:'ts'}));}}]});
  currentHttpServer=createServer(async(currentRequest,currentResponse)=>{
   try{
    if(currentRequest.url==='/result'){let currentResultBody='';for await(const currentBodyChunk of currentRequest)currentResultBody+=currentBodyChunk;currentResponse.end('ok');currentResultResolver(JSON.parse(currentResultBody));return;}
    if(currentRequest.url==='/bundle.js'){currentResponse.setHeader('Content-Type','text/javascript');currentResponse.end(currentBundleResult.outputFiles[0].text);return;}
    if(currentRequest.url===currentSdkIdentity.sdkUrl){currentSdkRequestCount++;currentResponse.setHeader('Content-Type','text/javascript');currentResponse.end(currentSdkSource);return;}
    if(currentRequest.url==='/v1/costumes'){currentResponse.setHeader('Content-Type','application/json');currentResponse.end(JSON.stringify({version:1,defaultCostumeId:'default',entries:[{costumeId:'default',version:1,designId:'default',designVersion:1,nameTranslations:{ko:'기본 의상',en:'Default'},descriptionTranslations:{ko:'기본 설명',en:'Description'}}]}));return;}
    if(currentRequest.url==='/v1/sponsorship/sdk/signed-manifest'){const currentServerTimestamp=Date.now()/1000;currentResponse.setHeader('Content-Type','application/json');currentResponse.end(JSON.stringify(signBrowserPayload({purpose:'slime-sponsor-sdk',issuedAt:currentServerTimestamp,expiresAt:currentServerTimestamp+300,...currentSdkIdentity})));return;}
    if(currentRequest.url==='/v1/costumes/default/sponsorship-sessions'){
     const currentRoomName=currentRequest.headers['x-test-room'];
     if(currentRoomName==='map:other')await new Promise(currentDelayResolver=>setTimeout(currentDelayResolver,500));
     const currentServerTimestamp=Date.now()/1000;
     const currentSessionPayload={purpose:'slime-costume-display',attemptId:randomUUID(),nonce:randomBytes(32).toString('base64url'),characterId:'hero',generation:1,epoch:Number(currentRequest.headers['x-test-epoch']),room:currentRoomName,costumeId:'default',sponsorshipId:'test',adAssetVersion:1,issuedAt:currentServerTimestamp,expiresAt:currentServerTimestamp+2,sdk:currentSdkIdentity,advertisement:{costumeId:'default',serverTime:currentServerTimestamp,sponsorship:{sponsorshipId:'test',version:1,endsAt:currentServerTimestamp+300,sponsorNameTranslations:{ko:'테스트 스폰서',en:'Test sponsor'},messageTranslations:{ko:'<img src=x onerror=alert(1)> '+currentRoomName,en:'Test '+currentRoomName}}}};
     currentResponse.setHeader('Content-Type','application/json');currentResponse.end(JSON.stringify({serverTime:currentServerTimestamp,session:signBrowserPayload(currentSessionPayload)}));return;
    }
    currentResponse.setHeader('Content-Type','text/html');currentResponse.end('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>');
   }catch(currentServerError){currentResponse.statusCode=500;currentResponse.end('테스트 서버 실패');currentResultRejecter(currentServerError);}
  });
  await new Promise(currentListenResolver=>currentHttpServer.listen(0,'127.0.0.1',currentListenResolver));
  currentResultTimeout=setTimeout(()=>currentResultRejecter(new Error('코스튬 광고 브라우저 검사 시간 초과')),20000);
  currentBrowserProcess=spawn(CURRENT_BROWSER_PATH,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',`--user-data-dir=${CURRENT_OUTPUT_ROOT}/profile`,`http://127.0.0.1:${currentHttpServer.address().port}/`],{stdio:['ignore','ignore','pipe']});
  currentBrowserProcess.on('error',currentResultRejecter);currentBrowserProcess.stderr.on('data',currentLogChunk=>{currentBrowserLog+=currentLogChunk;});
  const currentResultRecord=await currentBrowserResult;
  await writeFile(`${CURRENT_OUTPUT_ROOT}/result.json`,JSON.stringify(currentResultRecord));
  assert.equal(currentResultRecord.status,'PASS',JSON.stringify(currentResultRecord));assert.equal(currentSdkRequestCount,1);
  console.log(currentResultRecord.assertions.length+'개 실제 광고 UI 검사 통과');
 }finally{
  clearTimeout(currentResultTimeout);clearInterval(currentHeartbeatTimer);
  if(currentBrowserProcess&&currentBrowserProcess.exitCode===null){currentBrowserProcess.kill();await new Promise(currentExitResolver=>currentBrowserProcess.once('exit',currentExitResolver));}
  if(currentHttpServer){currentHttpServer.closeAllConnections();await new Promise(currentCloseResolver=>currentHttpServer.close(currentCloseResolver));}
  await writeFile(`${CURRENT_OUTPUT_ROOT}/chrome.log`,currentBrowserLog);console.log('코스튬 광고 브라우저 기록: '+CURRENT_OUTPUT_ROOT);
 }
});
