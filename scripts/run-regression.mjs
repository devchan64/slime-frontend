// 회귀검사 실행·로그·heartbeat·최종 결과 저장은 이 스크립트가 담당한다.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,rename,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
import {constants} from 'node:os';
const REGRESSION_TERMINATION_GRACE_MS=10000;
const REGRESSION_FAILURE_OUTPUT_LIMIT=4000;
const currentRunnerArguments=process.argv.slice(2);
const currentChecksEnabled=currentRunnerArguments[0]==='--with-checks';
const currentTestTargets=currentChecksEnabled?currentRunnerArguments.slice(1):currentRunnerArguments;
const currentCommandSteps=[...(currentChecksEnabled?[['scripts/check-locales.mjs'],['node_modules/typescript/bin/tsc','-b']]:[]),['--test',...currentTestTargets]];
if(!currentTestTargets.length||currentTestTargets.some(currentTestPath=>!/^tests\/[a-zA-Z0-9_./-]+\.test\.mjs$/.test(currentTestPath)||currentTestPath.includes('..')))throw new Error('사용법: node scripts/run-regression.mjs [--with-checks] tests/<대상>.test.mjs');
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
for(const currentTestTarget of currentTestTargets){
 try{
  if(!(await stat(currentTestTarget)).isFile())throw new Error('일반 파일이 아닙니다.');
 }catch(currentTargetError){
  currentExitCode=1;
  writeRegressionTrace('error',`검사 대상 확인 실패: ${currentTestTarget}: ${currentTargetError.message}`);
 }
}
for(const currentCommandArguments of currentCommandSteps){
 if(currentTerminationSignal||currentExitCode!==0)break;
 const currentStepStarted=performance.now();
 const currentExecutionArguments=currentCommandArguments[0]==='--test'
  ? ['--test','--test-reporter=tap','--test-reporter-destination=stdout','--test-reporter=junit',`--test-reporter-destination=${resolve(currentOutputDirectory,'junit.xml')}`,...currentCommandArguments.slice(1)]
  : currentCommandArguments;
 writeRegressionTrace('start',JSON.stringify(currentExecutionArguments));
 const currentTestProcess=spawn(process.execPath,currentExecutionArguments,{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
 currentActiveProcess=currentTestProcess;
 currentTestProcess.stdout.pipe(currentLogStream,{end:false});currentTestProcess.stderr.pipe(currentLogStream,{end:false});
 const currentHeartbeatTimer=setInterval(()=>writeRegressionTrace('heartbeat',`경과 ${Math.round((Date.now()-currentStartTime.getTime())/1000)}초`),5000);
 currentExitCode=await new Promise(currentResolve=>{currentTestProcess.once('error',currentProcessError=>{writeRegressionTrace('error',String(currentProcessError));currentResolve(1);});currentTestProcess.once('close',(currentProcessCode,currentProcessSignal)=>{currentStepResults.push({command:currentCommandArguments,exitCode:currentProcessCode,signal:currentProcessSignal,durationMs:Math.round(performance.now()-currentStepStarted)});currentResolve(currentProcessCode??(currentProcessSignal?128+constants.signals[currentProcessSignal]:1));});});
 currentActiveProcess=null;clearTimeout(currentTerminationTimer);
 if(currentTerminationSignal)currentExitCode=128+constants.signals[currentTerminationSignal];
 clearInterval(currentHeartbeatTimer);writeRegressionTrace('finish',`종료 코드 ${currentExitCode}`);
 if(currentExitCode!==0)break;
}
if(currentTerminationSignal)currentExitCode=128+constants.signals[currentTerminationSignal];
clearTimeout(currentTerminationTimer);
await new Promise(currentResolve=>currentLogStream.end(currentResolve));
const currentCompleteLog=await readFile(resolve(currentOutputDirectory,'run.log'),'utf8');
const currentSummaryValues=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(currentSummaryName=>{
 const currentSummaryMatches=[...currentCompleteLog.matchAll(new RegExp(`^# ${currentSummaryName} (\\d+)$`,'gm'))];
 return [currentSummaryName,currentSummaryMatches.length===1?Number(currentSummaryMatches[0][1]):null];
}));
let currentReportAvailable=false;
try{
 const currentJunitReport=await readFile(resolve(currentOutputDirectory,'junit.xml'),'utf8');
 currentReportAvailable=currentJunitReport.includes('<testsuites>')&&currentJunitReport.trimEnd().endsWith('</testsuites>');
}catch(currentReportError){
 if(currentReportError.code!=='ENOENT')currentReportAvailable=false;
}
const currentSummaryAvailable=currentReportAvailable&&Object.values(currentSummaryValues).every(currentSummaryValue=>Number.isSafeInteger(currentSummaryValue))
 && currentSummaryValues.tests===currentSummaryValues.pass+currentSummaryValues.fail+currentSummaryValues.cancelled+currentSummaryValues.skipped+currentSummaryValues.todo;
const currentTestSummary=currentSummaryAvailable?currentSummaryValues:null;
const currentElapsedSeconds=(Date.now()-currentStartTime.getTime())/1000;
await writeFile(resolve(currentOutputDirectory,'result.pending.json'),JSON.stringify({summary:currentTestSummary,durationSeconds:currentElapsedSeconds,junitPath:resolve(currentOutputDirectory,'junit.xml'),status:currentExitCode===0?'PASSED':'FAILED',exitCode:currentExitCode,terminationSignal:currentTerminationSignal,steps:currentStepResults,checksIncluded:currentChecksEnabled,targets:currentTestTargets,startedAt:currentStartTime.toISOString(),finishedAt:new Date().toISOString()},null,2)+'\n');
await rename(resolve(currentOutputDirectory,'result.pending.json'),resolve(currentOutputDirectory,'result.json'));
for(const [currentSignalName,currentSignalHandler] of currentSignalHandlers)process.removeListener(currentSignalName,currentSignalHandler);
const currentSummaryText=currentTestSummary
 ? `통과 ${currentTestSummary.pass} · 실패 ${currentTestSummary.fail} · 오류/중단 ${currentTestSummary.cancelled} · 건너뜀 ${currentTestSummary.skipped} · 미완성 ${currentTestSummary.todo}`
 : '집계 불가: 보고서 누락·손상 또는 검사 미완료';
console.log(`${currentSummaryText} · 종료 코드 ${currentExitCode} · ${currentElapsedSeconds.toFixed(2)}초 · ${currentOutputDirectory}`);
if(currentExitCode!==0){
 const currentFailureDetails=[...currentCompleteLog.matchAll(/^\s*not ok [^\n]+(?:\n[ \t]+[^\n]*)*/gm)].map(currentFailureMatch=>currentFailureMatch[0].trim());
 console.error((currentFailureDetails.join('\n')||'검사 실행기 또는 사전 검사 실패: 상세 원인은 run.log를 확인하세요.').slice(0,REGRESSION_FAILURE_OUTPUT_LIMIT));
}
process.exitCode=currentExitCode;
