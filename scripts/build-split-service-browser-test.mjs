// 실제 분리 서버 검사에 전달하는 브라우저 클라이언트 번들이다.
import {build} from 'esbuild';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const currentOutputPath=process.argv[2];
if(!currentOutputPath)throw new Error('검사 번들 출력 경로가 필요합니다.');
const currentLocaleSources={};
for(const currentLocaleName of ['ko','en'])for(const currentFileName of await readdir(`src/i18n/locales/${currentLocaleName}`))currentLocaleSources[`./locales/${currentLocaleName}/${currentFileName}`]=await readFile(`src/i18n/locales/${currentLocaleName}/${currentFileName}`,'utf8');
console.log(`${new Date().toISOString()}/test/split-browser-build 시작 ${resolve(currentOutputPath)}`);
await mkdir(dirname(resolve(currentOutputPath)),{recursive:true});
await build({entryPoints:['tests/fixtures/split-service-live-browser.ts'],bundle:true,platform:'browser',format:'iife',outfile:currentOutputPath,
 define:{'import.meta.env.VITE_API_BASE_URL':'globalThis.__SLIME_SPLIT_CONTEXT__.gameOrigin','import.meta.env.VITE_IDENTITY_API_BASE_URL':'globalThis.__SLIME_SPLIT_CONTEXT__.identityOrigin'},
 plugins:[{name:'split-browser-locales',setup(currentBuildContext){currentBuildContext.onLoad({filter:/\/i18n\/index\.ts$/},async({path:currentModulePath})=>({contents:(await readFile(currentModulePath,'utf8')).replace("import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })",JSON.stringify(currentLocaleSources)),loader:'ts'}));}}]});
console.log(`${new Date().toISOString()}/test/split-browser-build 완료`);
