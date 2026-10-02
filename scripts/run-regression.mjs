// 회귀검사 실행·로그·heartbeat·최종 결과 저장은 이 스크립트가 담당한다.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
import {constants} from 'node:os';
const REGRESSION_TERMINATION_GRACE_MS=10000;
const currentTestTargets=process.argv.slice(2);
if(!currentTestTargets.length||currentTestTargets.some(currentTestPath=>!/^tests\/[a-zA-Z0-9_./-]+\.test\.mjs$/.test(currentTestPath)||currentTestPath.includes('..')))throw new Error('tests 안의 검사 파일을 지정하세요.');
const currentStartTime=new Date();
const currentSeoulTimestamp=new Date(currentStartTime.getTime()+9*60*60*1000).toISOString().replace('T','_').replaceAll(':','-').replace('Z','');
const currentOutputDirectory=resolve('.tmp/test/frontend-regression',currentSeoulTimestamp);
await mkdir(currentOutputDirectory,{recursive:true});
const currentLogStream=createWriteStream(resolve(currentOutputDirectory,'run.log'));
function writeRegressionTrace(currentStageName,currentStageMessage){currentLogStream.write(`${new Date().toISOString()}/regression/${currentStageName} ${currentStageMessage}\n`);}
let currentExitCode=0;
let currentTerminationSignal=null;
let currentActiveProcess=null;
let currentTerminationTimer=null;
const currentStepResults=[];
function signalRegressionProcess(currentSignalName){
 if(!currentActiveProcess?.pid)return;
 try{process.kill(process.platform==='win32'?currentActiveProcess.pid:-currentActiveProcess.pid,currentSignalName);}
 catch(currentSignalError){if(currentSignalError.code!=='ESRCH')throw currentSignalError;}
}
function terminateRegressionProcess(currentSignalName){
 if(currentTerminationSignal)return;
 currentTerminationSignal=currentSignalName;
 writeRegressionTrace('terminate',`수신 신호 ${currentSignalName}`);
 signalRegressionProcess(currentSignalName);
 currentTerminationTimer=setTimeout(()=>{
  writeRegressionTrace('terminate','종료 유예 초과: 해당 검사 프로세스 그룹 강제 종료');
  signalRegressionProcess('SIGKILL');
 },REGRESSION_TERMINATION_GRACE_MS);
}
const currentSignalHandlers=new Map(['SIGTERM','SIGINT'].map(currentSignalName=>[currentSignalName,()=>terminateRegressionProcess(currentSignalName)]));
for(const [currentSignalName,currentSignalHandler] of currentSignalHandlers)process.on(currentSignalName,currentSignalHandler);
for(const currentCommandArguments of [['scripts/check-locales.mjs'],['node_modules/typescript/bin/tsc','-b'],['--test',...currentTestTargets]]){
 if(currentTerminationSignal)break;
 writeRegressionTrace('start',JSON.stringify(currentCommandArguments));
 const currentTestProcess=spawn(process.execPath,currentCommandArguments,{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
 currentActiveProcess=currentTestProcess;
 currentTestProcess.stdout.pipe(currentLogStream,{end:false});currentTestProcess.stderr.pipe(currentLogStream,{end:false});
 const currentHeartbeatTimer=setInterval(()=>writeRegressionTrace('heartbeat',`경과 ${Math.round((Date.now()-currentStartTime.getTime())/1000)}초`),5000);
 currentExitCode=await new Promise(currentResolve=>{currentTestProcess.once('error',currentProcessError=>{writeRegressionTrace('error',String(currentProcessError));currentResolve(1);});currentTestProcess.once('close',(currentProcessCode,currentProcessSignal)=>{currentStepResults.push({command:currentCommandArguments,exitCode:currentProcessCode,signal:currentProcessSignal});currentResolve(currentProcessCode??(currentProcessSignal?128+constants.signals[currentProcessSignal]:1));});});
 currentActiveProcess=null;clearTimeout(currentTerminationTimer);
 if(currentTerminationSignal)currentExitCode=128+constants.signals[currentTerminationSignal];
 clearInterval(currentHeartbeatTimer);writeRegressionTrace('finish',`종료 코드 ${currentExitCode}`);
 if(currentExitCode!==0)break;
}
if(currentTerminationSignal)currentExitCode=128+constants.signals[currentTerminationSignal];
clearTimeout(currentTerminationTimer);
await new Promise(currentResolve=>currentLogStream.end(currentResolve));
await writeFile(resolve(currentOutputDirectory,'result.pending.json'),JSON.stringify({status:currentExitCode===0?'PASSED':'FAILED',exitCode:currentExitCode,terminationSignal:currentTerminationSignal,steps:currentStepResults,targets:currentTestTargets,startedAt:currentStartTime.toISOString(),finishedAt:new Date().toISOString()},null,2)+'\n');
await rename(resolve(currentOutputDirectory,'result.pending.json'),resolve(currentOutputDirectory,'result.json'));
for(const [currentSignalName,currentSignalHandler] of currentSignalHandlers)process.removeListener(currentSignalName,currentSignalHandler);
console.log(`자동 회귀검사 완료: ${currentOutputDirectory} (종료 코드 ${currentExitCode})`);
if(currentExitCode!==0)console.error((await readFile(resolve(currentOutputDirectory,'run.log'),'utf8')).slice(-8192));
process.exitCode=currentExitCode;
