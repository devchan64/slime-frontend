import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const CURRENT_BROWSER_PATH=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const CURRENT_RUN_TIMESTAMP=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const CURRENT_OUTPUT_ROOT=resolve('.tmp/test/sponsor-sdk-verification',CURRENT_RUN_TIMESTAMP);
test('실제 Chrome Web Crypto로 신뢰한 키의 서명과 거절 경계를 검증한다',async()=>{
 await mkdir(CURRENT_OUTPUT_ROOT,{recursive:true});
 const currentHeartbeatTimer=setInterval(()=>console.log(new Date().toISOString()+'/test/sdk-browser 검증 진행'),5000);
 try{
  const currentKeyPair=generateKeyPairSync('ed25519');
  const currentPublicBytes=currentKeyPair.publicKey.export({format:'der',type:'spki'}).subarray(-32);
  const currentScriptDigest=createHash('sha256').update('SDK fixture').digest();
  const currentPayloadBytes=Buffer.from(JSON.stringify({purpose:'slime-sponsor-sdk',issuedAt:100.0,expiresAt:400.0,sdkVersion:1,sdkUrl:'/v1/sponsorship/sdk/1/'+currentScriptDigest.toString('hex')+'/costume.js',sdkIntegrity:'sha256-'+currentScriptDigest.toString('base64')}));
  const currentEnvelopeRecord={algorithm:'Ed25519',keyId:createHash('sha256').update(currentPublicBytes).digest('hex'),publicKey:currentPublicBytes.toString('base64'),payload:currentPayloadBytes.toString('base64'),signature:sign(null,currentPayloadBytes,currentKeyPair.privateKey).toString('base64')};
  const currentBrowserSource=`import {verifySponsorSdkManifest} from './src/client/sponsor-sdk-verification.mjs';
const currentEnvelopeRecord=${JSON.stringify(currentEnvelopeRecord)};
(async()=>{try{
 const currentVerifiedRecord=await verifySponsorSdkManifest(currentEnvelopeRecord,currentEnvelopeRecord.publicKey,100);
 if(currentVerifiedRecord.sdkVersion!==1||!Object.isFrozen(currentVerifiedRecord))throw new Error('정상 서명 검증 실패');
 for(const currentFailureCase of ['signature','key','expiry']){
  const currentCandidateRecord={...currentEnvelopeRecord};
  if(currentFailureCase==='signature')currentCandidateRecord.signature=btoa('x'.repeat(64));
  let currentRejectedFlag=false;
  try{await verifySponsorSdkManifest(currentCandidateRecord,currentFailureCase==='key'?btoa('x'.repeat(32)):currentEnvelopeRecord.publicKey,currentFailureCase==='expiry'?400:100);}catch{currentRejectedFlag=true;}
  if(!currentRejectedFlag)throw new Error('거절 누락: '+currentFailureCase);
 }
 document.body.dataset.result='PASS';
}catch(currentFailureError){document.body.dataset.result='FAIL: '+String(currentFailureError);}})();`;
  const currentBundleResult=await build({stdin:{contents:currentBrowserSource,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,platform:'browser',format:'iife'});
  await writeFile(`${CURRENT_OUTPUT_ROOT}/bundle.js`,currentBundleResult.outputFiles[0].text);
  await writeFile(`${CURRENT_OUTPUT_ROOT}/index.html`,'<!doctype html><meta charset="utf-8"><body><script src="bundle.js"></script></body>');
  const {stdout:currentBrowserDom,stderr:currentBrowserLog}=await promisify(execFile)(CURRENT_BROWSER_PATH,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',`--user-data-dir=${CURRENT_OUTPUT_ROOT}/profile`,'--dump-dom','--virtual-time-budget=5000',`file://${CURRENT_OUTPUT_ROOT}/index.html`],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
  await writeFile(`${CURRENT_OUTPUT_ROOT}/result.html`,currentBrowserDom);
  await writeFile(`${CURRENT_OUTPUT_ROOT}/chrome.log`,currentBrowserLog);
  assert.match(currentBrowserDom,/data-result="PASS"/,currentBrowserDom);
 }finally{clearInterval(currentHeartbeatTimer);console.log('SDK 브라우저 기록: '+CURRENT_OUTPUT_ROOT);}
});
