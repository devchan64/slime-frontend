import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir,appendFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
const CURRENT_BROWSER_PATH=process.env.CHROME_BIN || '/usr/bin/google-chrome';
const CURRENT_RUN_TIMESTAMP=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const CURRENT_OUTPUT_ROOT=resolve('.tmp/test/parcel-notice-browser',CURRENT_RUN_TIMESTAMP);

for(const currentFixtureName of ['parcel-notice','direct-messages'])test(`Chrome에서 ${currentFixtureName} 화면·세션 정리와 모바일 배치를 확인한다`,async()=>{
 const currentFixtureOutput=resolve(CURRENT_OUTPUT_ROOT,currentFixtureName);
 await mkdir(currentFixtureOutput,{recursive:true});
 const currentHeartbeatTimer=setInterval(()=>console.log(`${new Date().toISOString()}/test/parcel-notice-browser ${currentFixtureOutput}`),5000);
 try {
  const currentLocaleSources={};
  for(const currentLocaleName of ['ko','en'])for(const currentFileName of await readdir(`src/i18n/locales/${currentLocaleName}`))currentLocaleSources[`./locales/${currentLocaleName}/${currentFileName}`]=await readFile(`src/i18n/locales/${currentLocaleName}/${currentFileName}`,'utf8');
  await build({entryPoints:[`tests/fixtures/${currentFixtureName}-browser.tsx`],bundle:true,platform:'browser',format:'iife',jsx:'automatic',jsxImportSource:'preact',outfile:`${currentFixtureOutput}/test.js`,plugins:[{
   name:'real-parcel-locales',setup(currentBuildContext){currentBuildContext.onLoad({filter:/\/i18n\/index\.ts$/},async({path:currentModulePath})=>({contents:(await readFile(currentModulePath,'utf8')).replace("import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })",JSON.stringify(currentLocaleSources)),loader:'ts'}));}
  }]});
  const currentStylesText=(await readFile('src/styles.css','utf8')).replace('@import "./ui/design-system/tokens.css";',await readFile('src/ui/design-system/tokens.css','utf8'));
  await writeFile(`${currentFixtureOutput}/style.css`,currentStylesText);
  await writeFile(`${currentFixtureOutput}/index.html`,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="test.css"></head><body><div id="root"></div><script src="test.js"></script></body></html>');
  for(const currentLocaleName of ['ko','en']){
   const {stdout:currentBrowserDom,stderr:currentBrowserLog}=await promisify(execFile)(CURRENT_BROWSER_PATH,[
    '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
    `--user-data-dir=${currentFixtureOutput}/profile-${currentLocaleName}`,'--window-size=390,844','--dump-dom','--virtual-time-budget=10000',
    `--screenshot=${currentFixtureOutput}/${currentLocaleName}.png`,`file://${currentFixtureOutput}/index.html#${currentLocaleName}`
   ],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
   await writeFile(`${currentFixtureOutput}/${currentLocaleName}.html`,currentBrowserDom);
   await writeFile(`${currentFixtureOutput}/${currentLocaleName}.log`,currentBrowserLog);
   const currentResultText=currentBrowserDom.match(/data-result="([^"]*)"/)?.[1];
   assert.ok(currentResultText,'브라우저 검증 결과가 없습니다.');
   const currentResultRecord=JSON.parse(currentResultText.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
   await appendFile(`${currentFixtureOutput}/result.log`,JSON.stringify({locale:currentLocaleName,...currentResultRecord})+'\n');
   assert.equal(currentResultRecord.status,'PASS',JSON.stringify(currentResultRecord));
   console.log(`${currentLocaleName}: ${currentResultRecord.assertions.length}개 브라우저 검사 통과`);
  }
 }finally {clearInterval(currentHeartbeatTimer);console.log(`브라우저 기록: ${currentFixtureOutput}`);}
});
