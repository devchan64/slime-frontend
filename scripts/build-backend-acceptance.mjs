// 서버 수용 검사에 전달하는 공개 클라이언트 산출물과 해시·입력 목록을 함께 만든다.
import {build} from 'esbuild';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

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
];
const ACCEPTANCE_NODE_TARGETS=[
 ['scripts/text-client-core.mjs','text-client.mjs',['SLIME_TEXT_CLIENT_MODULE','SLIME_SUBSTITUTE_HUNT_TEXT_BUNDLE','SLIME_SPLIT_SERVICE_CLIENT_BUNDLE']],
 ['src/client/accountRewards.ts','account-rewards.mjs',['SLIME_ACCOUNT_REWARD_CLIENT_BUNDLE']],
 ['src/client/sponsor-sdk-verification.mjs','sponsor-verification.mjs',['SLIME_SPONSOR_VERIFICATION_MODULE']],
];
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
 const currentCommandArguments=[`scripts/build-${currentBuilderName}-browser-test.mjs`,currentArtifactPath];
 await writeAcceptanceTrace('command',JSON.stringify([process.execPath,...currentCommandArguments]));
 const currentBuildChunks=[];
 const currentChildProcess=spawn(process.execPath,currentCommandArguments,{stdio:['ignore','pipe','pipe']});
 currentChildProcess.stdout.on('data',currentOutputChunk=>currentBuildChunks.push(currentOutputChunk));
 currentChildProcess.stderr.on('data',currentOutputChunk=>currentBuildChunks.push(currentOutputChunk));
 const currentExitStatus=await new Promise((currentResolveExit,currentRejectExit)=>{
  currentChildProcess.once('error',currentRejectExit);
  currentChildProcess.once('close',(currentExitCode,currentExitSignal)=>currentResolveExit({code:currentExitCode,signal:currentExitSignal}));
 });
 await appendFile(currentLogPath,Buffer.concat(currentBuildChunks));
 if(currentExitStatus.code!==0)throw new Error(`검사 번들 생성 실패: ${currentBuilderName}, ${JSON.stringify(currentExitStatus)}`);
}
const currentHeartbeatTimer=setInterval(()=>{
 writeAcceptanceTrace('heartbeat',`${currentBuildStage}; 완료 ${currentManifestArtifacts.length}/12`).catch(currentLogError=>{console.error(currentLogError);process.exitCode=1;});
},ACCEPTANCE_HEARTBEAT_MILLISECONDS);
try{
 const currentSourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const currentWorkingTreeStatus=execFileSync('git',['status','--porcelain'],{encoding:'utf8'});
 await writeAcceptanceTrace('start',`출력 ${currentOutputRoot}; 원본 ${currentSourceRevision}`);
 for(const [currentBuilderName,currentEnvironmentName] of ACCEPTANCE_BROWSER_TARGETS){
  currentBuildStage=currentBuilderName;
  const currentArtifactPath=resolve(currentOutputRoot,currentBuilderName+'.js');
  await executeBrowserBuilder(currentBuilderName,currentArtifactPath);
  await captureAcceptanceArtifact(currentArtifactPath,[currentEnvironmentName]);
 }
 for(const [currentSourcePath,currentOutputName,currentEnvironmentNames] of ACCEPTANCE_NODE_TARGETS){
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
