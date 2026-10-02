// 완성된 dist만 제공하여 개발 서버 없이 로그인 화면이 실행되는지 검사한다.
import {createServer} from 'node:http';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const PRODUCTION_BUILD_ROOT=resolve('dist');
const PRODUCTION_BROWSER_PATH=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const PRODUCTION_RUN_TIMESTAMP=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const PRODUCTION_RESULT_ROOT=resolve('.tmp/test/production-build-browser',PRODUCTION_RUN_TIMESTAMP);
const PRODUCTION_CONTENT_TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const PRODUCTION_BROWSER_PROBE=`<script>
const currentBrowserErrors=[];
window.addEventListener('error',currentErrorEvent=>currentBrowserErrors.push(currentErrorEvent.message||'정적 파일 로드 실패'),true);
window.addEventListener('unhandledrejection',currentErrorEvent=>currentBrowserErrors.push(String(currentErrorEvent.reason)));
const currentProbeStarted=performance.now();
function inspectProductionLogin(){
 const currentLoginImage=document.querySelector('.login-illustration');
 const currentLoginReady=Boolean(document.querySelector('input[autocomplete="username"]')&&document.querySelector('#auth-password[type="password"]')&&document.querySelector('form button[type="submit"]'));
 const currentImageReady=Boolean(currentLoginImage&&currentLoginImage.complete&&currentLoginImage.naturalWidth>0);
 const currentStylesReady=document.styleSheets.length>0;
 if(currentLoginReady&&currentImageReady&&currentStylesReady||currentBrowserErrors.length||performance.now()-currentProbeStarted>10000){
  document.documentElement.dataset.productionResult=JSON.stringify({status:currentLoginReady&&currentImageReady&&currentStylesReady&&!currentBrowserErrors.length?'PASS':'FAIL',loginReady:currentLoginReady,imageReady:currentImageReady,stylesReady:currentStylesReady,errors:currentBrowserErrors});return;
 }
 setTimeout(inspectProductionLogin,100);
}
window.addEventListener('load',inspectProductionLogin);
</script>`;

function writeProductionBrowserTrace(currentStageName,currentStageMessage){
 const currentTraceLine=`${new Date().toISOString()}/production-browser/${currentStageName} ${currentStageMessage}`;
 appendFileSync(resolve(PRODUCTION_RESULT_ROOT,'run.log'),currentTraceLine+'\n');console.log(currentTraceLine);
}

await mkdir(PRODUCTION_RESULT_ROOT,{recursive:true});
const currentMissingPaths=[];
const currentServedAssets=new Set();
let currentHttpServer;
let currentFinalResult;
const currentHeartbeatTimer=setInterval(()=>writeProductionBrowserTrace('heartbeat','정적 번들 검사 중'),5000);
try{
 const currentEntryHtml=await readFile(resolve(PRODUCTION_BUILD_ROOT,'index.html'),'utf8');
 currentHttpServer=createServer(async(currentBrowserRequest,currentBrowserResponse)=>{
  try{
   const currentRequestPath=decodeURIComponent(new URL(currentBrowserRequest.url,'http://127.0.0.1').pathname);
   const currentFilePath=resolve(PRODUCTION_BUILD_ROOT,'.'+(currentRequestPath==='/'?'/index.html':currentRequestPath));
   if(!currentFilePath.startsWith(PRODUCTION_BUILD_ROOT+sep))throw new Error('정적 루트 외부 요청');
   const currentFileBytes=currentRequestPath==='/'||currentRequestPath==='/index.html'
    ?currentEntryHtml.replace('<head>','<head>'+PRODUCTION_BROWSER_PROBE):await readFile(currentFilePath);
   currentBrowserResponse.setHeader('Content-Type',PRODUCTION_CONTENT_TYPES[extname(currentFilePath)]||'application/octet-stream');
   currentBrowserResponse.end(currentFileBytes);currentServedAssets.add(currentRequestPath);
  }catch{currentMissingPaths.push(currentBrowserRequest.url);currentBrowserResponse.statusCode=404;currentBrowserResponse.end('정적 파일 없음');}
 });
 await new Promise(currentListenResolver=>currentHttpServer.listen(0,'127.0.0.1',currentListenResolver));
 writeProductionBrowserTrace('start',PRODUCTION_RESULT_ROOT);
 const {stdout:currentBrowserDom,stderr:currentBrowserLog}=await promisify(execFile)(PRODUCTION_BROWSER_PATH,[
  '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
  `--user-data-dir=${PRODUCTION_RESULT_ROOT}/profile`,'--window-size=390,844','--dump-dom','--virtual-time-budget=15000',
  `--screenshot=${PRODUCTION_RESULT_ROOT}/login.png`,`http://127.0.0.1:${currentHttpServer.address().port}/`
 ],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 await writeFile(resolve(PRODUCTION_RESULT_ROOT,'page.html'),currentBrowserDom);
 await writeFile(resolve(PRODUCTION_RESULT_ROOT,'chrome.log'),currentBrowserLog);
 const currentResultText=currentBrowserDom.match(/data-production-result="([^"]*)"/)?.[1];
 assert.ok(currentResultText,'실제 번들 실행 결과가 없습니다.');
 currentFinalResult=JSON.parse(currentResultText.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
 assert.equal(currentFinalResult.status,'PASS',JSON.stringify(currentFinalResult));
 assert.deepEqual(currentMissingPaths,[],'누락된 정적 경로가 있습니다.');
 assert.ok([...currentServedAssets].some(currentAssetPath=>/\/assets\/index-[^/]+\.js$/.test(currentAssetPath)),'해시 JS 번들을 로드하지 않았습니다.');
 currentFinalResult.servedAssets=[...currentServedAssets];
 currentFinalResult.indexSha256=createHash('sha256').update(currentEntryHtml).digest('hex');
}catch(currentCheckError){currentFinalResult={status:'FAIL',error:String(currentCheckError),missingPaths:currentMissingPaths};process.exitCode=1;writeProductionBrowserTrace('error',currentCheckError.stack||String(currentCheckError));}
finally{
 clearInterval(currentHeartbeatTimer);
 if(currentHttpServer){currentHttpServer.closeAllConnections();await new Promise(currentCloseResolver=>currentHttpServer.close(currentCloseResolver));}
 await writeFile(resolve(PRODUCTION_RESULT_ROOT,'result.json'),JSON.stringify(currentFinalResult,null,2)+'\n');
 writeProductionBrowserTrace('finish',`${currentFinalResult.status}: ${PRODUCTION_RESULT_ROOT}`);
}
