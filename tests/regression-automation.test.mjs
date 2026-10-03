import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';

const REGRESSION_RUNNER_SOURCE=resolve('scripts/run-regression.mjs');
for(const [currentSignalName,currentIgnoreSignal] of [['SIGTERM',false],['SIGINT',false],['SIGTERM',true]]){
 test(`자동화는 ${currentSignalName} 중단과 자식 종료 결과를 보존한다 (신호 무시: ${currentIgnoreSignal})`,{timeout:20000},async()=>{
  const currentTemporaryRoot=await mkdtemp(join(tmpdir(),'slime-regression-contract-'));
  try{
   await mkdir(join(currentTemporaryRoot,'scripts'));
   await mkdir(join(currentTemporaryRoot,'tests'));
   await writeFile(join(currentTemporaryRoot,'tests/example.test.mjs'),'');
   await copyFile(REGRESSION_RUNNER_SOURCE,join(currentTemporaryRoot,'scripts/run-regression.mjs'));
   await writeFile(join(currentTemporaryRoot,'scripts/check-locales.mjs'),`${currentIgnoreSignal?'process.on("SIGTERM",()=>{});':''}setTimeout(()=>process.exit(9),16000); setInterval(()=>{},1000); setTimeout(()=>process.kill(process.ppid,${JSON.stringify(currentSignalName)}),100);`);
   const currentRunnerProcess=spawn(process.execPath,['scripts/run-regression.mjs','--with-checks','tests/example.test.mjs'],{cwd:currentTemporaryRoot,env:{...process.env,NODE_TEST_CONTEXT:undefined},timeout:18000,killSignal:'SIGKILL',stdio:['ignore','pipe','pipe']});
   let currentRunnerOutput='';
   currentRunnerProcess.stdout.on('data',currentOutputChunk=>{currentRunnerOutput+=currentOutputChunk;});
   currentRunnerProcess.stderr.on('data',currentOutputChunk=>{currentRunnerOutput+=currentOutputChunk;});
   const currentRunnerExit=await new Promise((currentResolveExit,currentRejectError)=>{
    currentRunnerProcess.once('error',currentRejectError);
    currentRunnerProcess.once('close',(currentExitCode,currentExitSignal)=>currentResolveExit({code:currentExitCode,signal:currentExitSignal}));
   });
   assert.deepEqual(currentRunnerExit,{code:currentSignalName==='SIGTERM'?143:130,signal:null},currentRunnerOutput);
   const currentOutputRoot=join(currentTemporaryRoot,'.tmp/test/frontend-regression');
   const currentResultDirectories=await readdir(currentOutputRoot);
   assert.equal(currentResultDirectories.length,1);
   const currentResultDirectory=join(currentOutputRoot,currentResultDirectories[0]);
   const currentResultRecord=JSON.parse(await readFile(join(currentResultDirectory,'result.json'),'utf8'));
   assert.equal(currentResultRecord.status,'FAILED');
   assert.equal(currentResultRecord.terminationSignal,currentSignalName);
   assert.equal(currentResultRecord.summary,null,'중단된 사전 검사는 0건 통과로 표시하지 않는다');
   assert.equal(currentResultRecord.steps.length,1,'중단 후 다음 검사 단계를 실행하지 않는다');
   assert.equal(currentResultRecord.steps[0].signal,currentIgnoreSignal?'SIGKILL':currentSignalName);
   assert.equal(currentResultRecord.steps[0].exitCode,null);
   assert.ok(!(await readdir(currentResultDirectory)).includes('result.pending.json'));
  }finally{await rm(currentTemporaryRoot,{recursive:true,force:true});}
 });
}

for(const currentChecksEnabled of [false,true]){
 test(`선택 검사만 실행하고 명시한 경우에만 사전 검사를 포함한다 (${currentChecksEnabled})`,async()=>{
  const currentTemporaryRoot=await mkdtemp(join(tmpdir(),'slime-regression-scope-'));
  try{
   await mkdir(join(currentTemporaryRoot,'scripts'));
   await mkdir(join(currentTemporaryRoot,'tests'));
   await copyFile(REGRESSION_RUNNER_SOURCE,join(currentTemporaryRoot,'scripts/run-regression.mjs'));
   await writeFile(join(currentTemporaryRoot,'tests/example.test.mjs'),'import {test} from "node:test";test("통과 사례",()=>console.log("성공 상세 로그"));test.skip("보류 사례",()=>{});');
   if(currentChecksEnabled){
    await writeFile(join(currentTemporaryRoot,'scripts/check-locales.mjs'),'console.log("번역 검사 실행");');
    await mkdir(join(currentTemporaryRoot,'node_modules/typescript/bin'),{recursive:true});
    await writeFile(join(currentTemporaryRoot,'node_modules/typescript/bin/tsc'),'console.log("타입 검사 실행");');
   }
   const currentRunnerProcess=spawn(process.execPath,['scripts/run-regression.mjs',...(currentChecksEnabled?['--with-checks']:[]),'tests/example.test.mjs'],{cwd:currentTemporaryRoot,env:{...process.env,NODE_TEST_CONTEXT:undefined},timeout:5000,stdio:'ignore'});
   const currentRunnerExit=await new Promise((currentResolveExit,currentRejectError)=>{
    currentRunnerProcess.once('error',currentRejectError);
    currentRunnerProcess.once('close',currentResolveExit);
   });
   assert.equal(currentRunnerExit,0);
   const currentOutputRoot=join(currentTemporaryRoot,'.tmp/test/frontend-regression');
   const [currentResultDirectory]=await readdir(currentOutputRoot);
   const currentResultRecord=JSON.parse(await readFile(join(currentOutputRoot,currentResultDirectory,'result.json'),'utf8'));
   assert.equal(currentResultRecord.status,'PASSED');
   assert.equal(currentResultRecord.checksIncluded,currentChecksEnabled);
   assert.deepEqual(currentResultRecord.summary,{tests:2,pass:1,fail:0,cancelled:0,skipped:1,todo:0});
   assert.ok((await readFile(currentResultRecord.junitPath,'utf8')).includes('</testsuites>'));
   assert.ok(currentResultRecord.durationSeconds>=0);
   assert.deepEqual(currentResultRecord.steps.map(currentStepResult=>currentStepResult.command),[
    ...(currentChecksEnabled?[['scripts/check-locales.mjs'],['node_modules/typescript/bin/tsc','-b']]:[]),['--test','tests/example.test.mjs'],
   ]);
   assert.ok(currentResultRecord.steps.every(currentStepResult=>Number.isInteger(currentStepResult.durationMs)&&currentStepResult.durationMs>=0));
  }finally{await rm(currentTemporaryRoot,{recursive:true,force:true});}
 });
}

test('존재하는 검사와 누락된 검사를 함께 지정하면 실행 전에 실패한다',async()=>{
 const currentTemporaryRoot=await mkdtemp(join(tmpdir(),'slime-regression-missing-'));
 try{
  await mkdir(join(currentTemporaryRoot,'scripts'));await mkdir(join(currentTemporaryRoot,'tests'));
  await copyFile(REGRESSION_RUNNER_SOURCE,join(currentTemporaryRoot,'scripts/run-regression.mjs'));
  await writeFile(join(currentTemporaryRoot,'tests/example.test.mjs'),'');
  const currentRunnerProcess=spawn(process.execPath,['scripts/run-regression.mjs','tests/example.test.mjs','tests/missing.test.mjs'],{cwd:currentTemporaryRoot,env:{...process.env,NODE_TEST_CONTEXT:undefined},stdio:'ignore'});
  const currentRunnerExit=await new Promise((resolveRunnerExit,rejectRunnerError)=>{currentRunnerProcess.once('error',rejectRunnerError);currentRunnerProcess.once('close',resolveRunnerExit);});
  assert.equal(currentRunnerExit,1);
  const currentOutputRoot=join(currentTemporaryRoot,'.tmp/test/frontend-regression');
  const [currentResultDirectory]=await readdir(currentOutputRoot);
  const currentResultPath=join(currentOutputRoot,currentResultDirectory);
  const currentResultRecord=JSON.parse(await readFile(join(currentResultPath,'result.json'),'utf8'));
  assert.equal(currentResultRecord.status,'FAILED');assert.equal(currentResultRecord.summary,null);assert.deepEqual(currentResultRecord.steps,[]);
  assert.match(await readFile(join(currentResultPath,'run.log'),'utf8'),/검사 대상 확인 실패: tests\/missing.test.mjs/);
 }finally{await rm(currentTemporaryRoot,{recursive:true,force:true});}
});
