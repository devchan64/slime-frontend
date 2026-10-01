// 실제 서버 연결 검사에 전달할 공개 클라이언트 번들을 만든다.
import {build} from 'esbuild';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const currentOutputPath=process.argv[2];
if(!currentOutputPath)throw new Error('검사 번들의 출력 경로가 필요합니다.');
const currentLocaleSources={};
for(const currentLocaleName of ['ko','en'])for(const currentFileName of await readdir(`src/i18n/locales/${currentLocaleName}`))currentLocaleSources[`./locales/${currentLocaleName}/${currentFileName}`]=await readFile(`src/i18n/locales/${currentLocaleName}/${currentFileName}`,'utf8');
console.log(`${new Date().toISOString()}/test/traveler-barter-build 시작 ${resolve(currentOutputPath)}`);
await mkdir(dirname(resolve(currentOutputPath)),{recursive:true});
await build({entryPoints:['tests/fixtures/traveler-barter-live-browser.tsx'],bundle:true,platform:'browser',format:'iife',jsx:'automatic',jsxImportSource:'preact',outfile:currentOutputPath,define:{'import.meta.env.VITE_API_BASE_URL':'""'},plugins:[{
 name:'traveler-barter-live-locales',setup(currentBuildContext){currentBuildContext.onLoad({filter:/\/i18n\/index\.ts$/},async({path:currentModulePath})=>({contents:(await readFile(currentModulePath,'utf8')).replace("import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })",JSON.stringify(currentLocaleSources)),loader:'ts'}));}
}]});
console.log(`${new Date().toISOString()}/test/traveler-barter-build 완료`);
