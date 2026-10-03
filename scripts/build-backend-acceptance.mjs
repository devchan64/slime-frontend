// 서버 수용 검사에 전달하는 공개 클라이언트 산출물과 해시·입력 목록을 함께 만든다.
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';

const ACCEPTANCE_BROWSER_TARGETS=[
 ['costume','SLIME_COSTUME_BROWSER_BUNDLE'],
 ['substitute-hunt','SLIME_SUBSTITUTE_HUNT_BROWSER_BUNDLE'],
 ['npc','SLIME_NPC_BROWSER_BUNDLE'],
 ['parcel','SLIME_PARCEL_BROWSER_BUNDLE'],
 ['skillbook','SLIME_SKILLBOOK_BROWSER_BUNDLE'],
 ['refining','SLIME_PROCESSING_BROWSER_BUNDLE'],
 ['split-service','SLIME_SPLIT_BROWSER_BUNDLE'],
 ['traveler-barter','SLIME_TRAVELER_BROWSER_BUNDLE'],
 ['costume-sponsor','SLIME_COSTUME_SPONSOR_BROWSER_BUNDLE'],
 ['production','SLIME_PRODUCTION_BROWSER_BUNDLE'],
 ['refining-mission','SLIME_MISSION_BROWSER_BUNDLE'],
];
const ACCEPTANCE_NODE_TARGETS=[
 ['scripts/text-client-core.mjs','text-client.mjs',['SLIME_TEXT_CLIENT_MODULE','SLIME_SUBSTITUTE_HUNT_TEXT_BUNDLE','SLIME_SPLIT_SERVICE_CLIENT_BUNDLE']],
 ['src/client/accountRewards.ts','account-rewards.mjs',['SLIME_ACCOUNT_REWARD_CLIENT_BUNDLE']],
 ['src/client/sponsor-sdk-verification.mjs','sponsor-verification.mjs',['SLIME_SPONSOR_VERIFICATION_MODULE']],
];
const ACCEPTANCE_BROWSER_FIXTURES=Object.fromEntries([
 ...ACCEPTANCE_BROWSER_TARGETS.map(([currentTargetName])=>[currentTargetName,`tests/fixtures/${currentTargetName}-live-browser.${currentTargetName==='split-service'?'ts':'tsx'}`]),
]);
const ACCEPTANCE_LOCALE_EXPRESSION="import.meta.glob('./locales/*/*.yaml', { query: '?raw', import: 'default', eager: true })";
const currentCommandArguments=process.argv.slice(2);
if(currentCommandArguments.length!==0 && (currentCommandArguments.length!==2 || !Object.hasOwn(ACCEPTANCE_BROWSER_FIXTURES,currentCommandArguments[0]))) {
 throw new Error(`사용법: node scripts/build-backend-acceptance.mjs [대상 출력.js]; 대상: ${Object.keys(ACCEPTANCE_BROWSER_FIXTURES).join(', ')}`);
}
const currentSingleTarget=currentCommandArguments[0];
const currentBrowserTargets=currentSingleTarget?[[currentSingleTarget,ACCEPTANCE_BROWSER_TARGETS.find(([currentTargetName])=>currentTargetName===currentSingleTarget)?.[1]]]:ACCEPTANCE_BROWSER_TARGETS;
const currentNodeTargets=currentSingleTarget?[]:ACCEPTANCE_NODE_TARGETS;
const currentArtifactTotal=currentBrowserTargets.length+currentNodeTargets.length;
const ACCEPTANCE_HEARTBEAT_MILLISECONDS=5000;
const currentRunTimestamp=new Date(Date.now()+9*60*60*1000).toISOString().replace('T','_').replaceAll(':','-').replace('Z','');
const currentOutputRoot=resolve('.tmp/test/backend-client-acceptance',currentRunTimestamp);
const currentManifestEnvironment={};
const currentManifestArtifacts=[];
let currentBuildStage='초기화';
let currentBuildResult;
await mkdir(resolve('.tmp/test/backend-client-acceptance'),{recursive:true});
await mkdir(currentOutputRoot);
const currentLogPath=resolve(currentOutputRoot,'build.log');
async function writeAcceptanceTrace(currentStageName,currentStageMessage){
 await appendFile(currentLogPath,`${new Date().toISOString()}/acceptance/${currentStageName} ${currentStageMessage}\n`);
}
async function captureAcceptanceArtifact(currentArtifactPath,currentEnvironmentNames){
 const currentArtifactBytes=await readFile(currentArtifactPath);
 if(!currentArtifactBytes.length)throw new Error(`빈 검사 번들: ${currentArtifactPath}`);
 currentManifestArtifacts.push({path:currentArtifactPath,sha256:createHash('sha256').update(currentArtifactBytes).digest('hex')});
 for(const currentEnvironmentName of currentEnvironmentNames)currentManifestEnvironment[currentEnvironmentName]=currentArtifactPath;
}
async function executeBrowserBuilder(currentBuilderName,currentArtifactPath){
 const currentLocaleSources={};
 for(const currentLocaleName of ['ko','en'])for(const currentFileName of await readdir(`src/i18n/locales/${currentLocaleName}`)) {
  currentLocaleSources[`./locales/${currentLocaleName}/${currentFileName}`]=await readFile(`src/i18n/locales/${currentLocaleName}/${currentFileName}`,'utf8');
 }
 const currentBuildDefinitions={'import.meta.env.VITE_API_BASE_URL':'""','import.meta.env.VITE_IDENTITY_API_BASE_URL':'undefined'};
 if(currentBuilderName==='split-service')Object.assign(currentBuildDefinitions,{
  'import.meta.env.VITE_API_BASE_URL':'globalThis.__SLIME_SPLIT_CONTEXT__.gameOrigin',
  'import.meta.env.VITE_IDENTITY_API_BASE_URL':'globalThis.__SLIME_SPLIT_CONTEXT__.identityOrigin',
 });
 if(currentBuilderName==='costume-sponsor')currentBuildDefinitions['import.meta.env.VITE_SPONSOR_PUBLIC_KEY']='globalThis.__TEST_SPONSOR_PUBLIC_KEY';
 await writeAcceptanceTrace('browser-build',`${currentBuilderName}: ${currentArtifactPath}`);
 await mkdir(dirname(currentArtifactPath),{recursive:true});
 await build({entryPoints:[ACCEPTANCE_BROWSER_FIXTURES[currentBuilderName]],bundle:true,platform:'browser',format:'iife',
  jsx:'automatic',jsxImportSource:'preact',outfile:currentArtifactPath,define:currentBuildDefinitions,plugins:[{
   name:'acceptance-browser-locales',setup(currentBuildContext){
    if(currentBuilderName==='costume-sponsor')currentBuildContext.onLoad({filter:/CostumeDescription\.tsx$/},async({path:currentModulePath})=>({
     contents:(await readFile(currentModulePath,'utf8')).replace('ready.catch(()=>{','ready.catch((currentDisplayError)=>{globalThis.__TEST_SPONSOR_ERROR=String(currentDisplayError);'),loader:'tsx',
    }));
    currentBuildContext.onLoad({filter:/\/i18n\/index\.ts$/},async({path:currentModulePath})=>{
     const currentModuleSource=await readFile(currentModulePath,'utf8');
     if(!currentModuleSource.includes(ACCEPTANCE_LOCALE_EXPRESSION))throw new Error(`언어팩 주입 위치가 없습니다: ${currentModulePath}`);
     return {contents:currentModuleSource.replace(ACCEPTANCE_LOCALE_EXPRESSION,JSON.stringify(currentLocaleSources)),loader:'ts'};
    });
   },
  }]});
}
const currentHeartbeatTimer=setInterval(()=>{
 writeAcceptanceTrace('heartbeat',`${currentBuildStage}; 완료 ${currentManifestArtifacts.length}/${currentArtifactTotal}`).catch(currentLogError=>{console.error(currentLogError);process.exitCode=1;});
},ACCEPTANCE_HEARTBEAT_MILLISECONDS);
try{
 const currentSourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const currentWorkingTreeStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'});
 await writeAcceptanceTrace('start',`출력 ${currentOutputRoot}; 원본 ${currentSourceRevision}`);
 for(const [currentBuilderName,currentEnvironmentName] of currentBrowserTargets){
  currentBuildStage=currentBuilderName;
  const currentArtifactPath=currentSingleTarget?resolve(currentCommandArguments[1]):resolve(currentOutputRoot,currentBuilderName+'.js');
  await executeBrowserBuilder(currentBuilderName,currentArtifactPath);
  await captureAcceptanceArtifact(currentArtifactPath,currentEnvironmentName?[currentEnvironmentName]:[]);
 }
 for(const [currentSourcePath,currentOutputName,currentEnvironmentNames] of currentNodeTargets){
  currentBuildStage=currentSourcePath;
  const currentArtifactPath=resolve(currentOutputRoot,currentOutputName);
  await writeAcceptanceTrace('node-build',currentSourcePath);
  await build({entryPoints:[currentSourcePath],bundle:true,platform:'node',format:'esm',outfile:currentArtifactPath});
  await captureAcceptanceArtifact(currentArtifactPath,currentEnvironmentNames);
 }
 const currentManifestRecord={revision:currentSourceRevision,workingTreeStatus:currentWorkingTreeStatus,
  environment:currentManifestEnvironment,artifacts:currentManifestArtifacts};
 await writeFile(resolve(currentOutputRoot,'manifest.json'),JSON.stringify(currentManifestRecord,null,2)+'\n');
 currentBuildResult={status:'PASSED',manifest:resolve(currentOutputRoot,'manifest.json'),artifactCount:currentManifestArtifacts.length};
}catch(currentBuildError){
 currentBuildResult={status:'FAILED',stage:currentBuildStage,error:String(currentBuildError)};
 await writeAcceptanceTrace('error',currentBuildError.stack||String(currentBuildError));
 process.exitCode=1;
}finally{
 clearInterval(currentHeartbeatTimer);
 await writeFile(resolve(currentOutputRoot,'result.json'),JSON.stringify(currentBuildResult,null,2)+'\n');
 await writeAcceptanceTrace('finish',JSON.stringify(currentBuildResult));
 console.log(`검사 번들 생성 ${currentBuildResult.status}: ${currentOutputRoot}`);
 if(currentBuildResult.status==='FAILED')console.error((await readFile(currentLogPath,'utf8')).slice(-8192));
}
