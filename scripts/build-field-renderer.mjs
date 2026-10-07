import {build} from 'esbuild';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const currentProjectRoot=fileURLToPath(new URL('../',import.meta.url));
const currentPackageRecord=JSON.parse(await readFile(new URL('../packages/field-renderer/package.json',import.meta.url),'utf8'));
const currentOutputDirectory=path.join(currentProjectRoot,'.tmp/field-renderer',currentPackageRecord.version);
const currentSourceEntries={'town-renderer.mjs':'packages/field-renderer/town-renderer.ts','game-render-profile.mjs':'packages/field-renderer/game-render-profile.ts','field-renderer.mjs':'packages/field-renderer/field-renderer.mjs','phaser.mjs':'node_modules/phaser/dist/phaser.esm.js'};

/** 엔진은 공유하고, 이미지 경로·번역 원문은 빌드 단계에서 고정한다. */
function createSharedRuntimePlugin(){
 return {name:'shared-runtime-assets',setup(currentBuildContext){
  currentBuildContext.onResolve({filter:/^phaser$/},()=>({path:'shared-phaser',namespace:'shared-phaser'}));
  currentBuildContext.onLoad({filter:/.*/,namespace:'shared-phaser'},()=>({contents:"import * as Phaser from './phaser.mjs'; export default Phaser;",loader:'js'}));
  currentBuildContext.onResolve({filter:/^\.\/phaser\.mjs$/},()=>({path:'./phaser.mjs',external:true}));
  currentBuildContext.onLoad({filter:/[\/]i18n[\/]index\.ts$/},async currentSourceArguments=>{
   const currentLocaleSources={};
   for(const currentLocaleName of ['ko','en']){
    const currentLocaleDirectory=path.join(path.dirname(currentSourceArguments.path),'locales',currentLocaleName);
    for(const currentLocaleFile of await readdir(currentLocaleDirectory)){
     if(currentLocaleFile.endsWith('.yaml'))currentLocaleSources[`./locales/${currentLocaleName}/${currentLocaleFile}`]=await readFile(path.join(currentLocaleDirectory,currentLocaleFile),'utf8');
    }
   }
   const currentSourceText=await readFile(currentSourceArguments.path,'utf8');
   const currentGlobExpression="import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })";
   if(!currentSourceText.includes(currentGlobExpression))throw Error('번역 카탈로그 빌드 계약이 변경되었습니다.');
   return {contents:currentSourceText.replace(currentGlobExpression,JSON.stringify(currentLocaleSources)),loader:'ts',resolveDir:path.dirname(currentSourceArguments.path)};
  });
  currentBuildContext.onLoad({filter:/\.png$/},currentSourceArguments=>{
   const currentAssetSuffix=currentSourceArguments.path.split('/slime-assets/assets/')[1];
   if(!currentAssetSuffix)throw Error('등록 에셋 저장소 밖의 이미지입니다: '+currentSourceArguments.path);
   return {contents:'export default '+JSON.stringify('assets/'+currentAssetSuffix),loader:'js'};
  });
 }};
}

try{
 console.log(`${new Date().toISOString()}/field-renderer/build/시작 ${currentOutputDirectory}`);
 await mkdir(currentOutputDirectory,{recursive:true});
 const currentFileHashes={};
 for(const [currentOutputName,currentSourcePath] of Object.entries(currentSourceEntries)){
  const currentOutputPath=path.join(currentOutputDirectory,currentOutputName);
  await build({entryPoints:[path.join(currentProjectRoot,currentSourcePath)],outfile:currentOutputPath,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:currentOutputName==='phaser.mjs',legalComments:'eof',plugins:currentOutputName==='town-renderer.mjs'?[createSharedRuntimePlugin()]:[]});
  currentFileHashes[currentOutputName]=createHash('sha256').update(await readFile(currentOutputPath)).digest('hex');
 }
 const currentEngineLicense=await readFile(path.join(currentProjectRoot,'node_modules/phaser/LICENSE.md'));
 await writeFile(path.join(currentOutputDirectory,'LICENSE.phaser.md'),currentEngineLicense);
 currentFileHashes['LICENSE.phaser.md']=createHash('sha256').update(currentEngineLicense).digest('hex');
 const currentManifestRecord=`package: '@slime/field-renderer'\nversion: '${currentPackageRecord.version}'\nengine: 'Phaser 3.90.0'\nsource_repository: slime-frontend\nsource_path: packages/field-renderer\nfiles:\n${Object.entries(currentFileHashes).map(([currentFileName,currentFileHash])=>`  ${currentFileName}: ${currentFileHash}`).join('\n')}\n`;
 await writeFile(path.join(currentOutputDirectory,'manifest.yaml'),currentManifestRecord);
 console.log(`${new Date().toISOString()}/field-renderer/build/완료 ${currentOutputDirectory}`);
}catch(currentBuildError){console.error(`${new Date().toISOString()}/field-renderer/failure ${currentBuildError.stack}`);process.exitCode=1;}
