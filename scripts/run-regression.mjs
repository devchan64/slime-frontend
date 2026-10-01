// 회귀검사 실행·로그·heartbeat·최종 결과 저장은 이 스크립트가 담당한다.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
const currentTestTargets=process.argv.slice(2);
if(!currentTestTargets.length||currentTestTargets.some(currentTestPath=>!/^tests\/[a-zA-Z0-9_./-]+\.test\.mjs$/.test(currentTestPath)||currentTestPath.includes('..')))throw new Error('tests 안의 검사 파일을 지정하세요.');
const currentStartTime=new Date();
const currentSeoulTimestamp=new Date(currentStartTime.getTime()+9*60*60*1000).toISOString().replace('T','_').replaceAll(':','-').replace('Z','');
const currentOutputDirectory=resolve('.tmp/test/frontend-regression',currentSeoulTimestamp);
await mkdir(currentOutputDirectory,{recursive:true});
const currentLogStream=createWriteStream(resolve(currentOutputDirectory,'run.log'));
function writeRegressionTrace(currentStageName,currentStageMessage){currentLogStream.write(`${new Date().toISOString()}/regression/${currentStageName} ${currentStageMessage}\n`);}
let currentExitCode=0;
for(const currentCommandArguments of [['scripts/check-locales.mjs'],['node_modules/typescript/bin/tsc','-b'],['--test',...currentTestTargets]]){
 writeRegressionTrace('start',JSON.stringify(currentCommandArguments));
 const currentTestProcess=spawn(process.execPath,currentCommandArguments,{stdio:['ignore','pipe','pipe']});
 currentTestProcess.stdout.pipe(currentLogStream,{end:false});currentTestProcess.stderr.pipe(currentLogStream,{end:false});
 const currentHeartbeatTimer=setInterval(()=>writeRegressionTrace('heartbeat',`경과 ${Math.round((Date.now()-currentStartTime.getTime())/1000)}초`),5000);
 currentExitCode=await new Promise(currentResolve=>{currentTestProcess.once('error',currentProcessError=>{writeRegressionTrace('error',String(currentProcessError));currentResolve(1);});currentTestProcess.once('close',currentProcessCode=>currentResolve(currentProcessCode??1));});
 clearInterval(currentHeartbeatTimer);writeRegressionTrace('finish',`종료 코드 ${currentExitCode}`);
 if(currentExitCode!==0)break;
}
await new Promise(currentResolve=>currentLogStream.end(currentResolve));
await writeFile(resolve(currentOutputDirectory,'result.json'),JSON.stringify({status:currentExitCode===0?'PASSED':'FAILED',exitCode:currentExitCode,targets:currentTestTargets,startedAt:currentStartTime.toISOString(),finishedAt:new Date().toISOString()},null,2)+'\n');
console.log(`자동 회귀검사 완료: ${currentOutputDirectory} (종료 코드 ${currentExitCode})`);
if(currentExitCode!==0)console.error((await readFile(resolve(currentOutputDirectory,'run.log'),'utf8')).slice(-8192));
process.exitCode=currentExitCode;
