import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';

const CURRENT_BROWSER_PATH=process.env.CHROME_BIN || '/usr/bin/google-chrome';
const CURRENT_RUN_TIMESTAMP=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','-');
const CURRENT_OUTPUT_ROOT=resolve('.tmp/test/skill-ui-browser',CURRENT_RUN_TIMESTAMP);

test('실제 Chrome에서 한국어·영어 스킬 선택·효과·확정·갱신을 검증한다',async()=>{
 await mkdir(CURRENT_OUTPUT_ROOT,{recursive:true});
 const current_locale_sources={};
 for(const current_locale_name of ['ko','en'])for(const current_file_name of await readdir(`src/i18n/locales/${current_locale_name}`)){
  current_locale_sources[`./locales/${current_locale_name}/${current_file_name}`]=await readFile(`src/i18n/locales/${current_locale_name}/${current_file_name}`,'utf8');
 }
 await build({entryPoints:['tests/fixtures/skill-actions-browser.tsx'],bundle:true,platform:'browser',format:'iife',jsx:'automatic',jsxImportSource:'preact',outfile:`${CURRENT_OUTPUT_ROOT}/test.js`,plugins:[{
  name:'real-locale-catalogs',setup(current_build_context){
   current_build_context.onResolve({filter:/^\.\/(BattleActionPoints|battleActionPoints)$/},current_import_path=>({path:resolve('src/ui',current_import_path.path.endsWith('/BattleActionPoints')?'BattleActionPoints.tsx':'battleActionPoints.ts')}));
   current_build_context.onLoad({filter:/\/i18n\/index\.ts$/},async({path:current_module_path})=>({contents:(await readFile(current_module_path,'utf8')).replace("import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })",JSON.stringify(current_locale_sources)),loader:'ts'}));
  }
 }]});
 const current_styles_text=(await readFile('src/styles.css','utf8')).replace('@import "./ui/design-system/tokens.css";',await readFile('src/ui/design-system/tokens.css','utf8'));
 await writeFile(`${CURRENT_OUTPUT_ROOT}/style.css`,current_styles_text);
 await writeFile(`${CURRENT_OUTPUT_ROOT}/index.html`,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="test.js"></script></body></html>');
 for(const current_locale_name of ['ko','en']){
  const {stdout:current_browser_dom,stderr:current_browser_log}=await promisify(execFile)(CURRENT_BROWSER_PATH,[
   '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
   `--user-data-dir=${CURRENT_OUTPUT_ROOT}/profile-${current_locale_name}`,'--window-size=390,844','--dump-dom','--virtual-time-budget=10000',
   `file://${CURRENT_OUTPUT_ROOT}/index.html#${current_locale_name}`
  ],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  await writeFile(`${CURRENT_OUTPUT_ROOT}/${current_locale_name}.html`,current_browser_dom);
  await writeFile(`${CURRENT_OUTPUT_ROOT}/${current_locale_name}.log`,current_browser_log);
  const current_result_text=current_browser_dom.match(/data-result="([^"]*)"/)?.[1];
  assert.ok(current_result_text,'브라우저 검증 결과가 없습니다.');
  const current_result_record=JSON.parse(current_result_text.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
  assert.equal(current_result_record.status,'PASS',JSON.stringify(current_result_record));
  assert.deepEqual(current_result_record.commands,[['SKILL','friend','healing_mend']]);
  console.log(`${current_locale_name}: ${current_result_record.assertions.length}개 브라우저 검증 통과`);
 }
});
