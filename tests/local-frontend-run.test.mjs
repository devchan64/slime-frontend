import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, copyFile, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

// 실제 개발 서버 대신 격리된 프로세스를 종료해 동의 경계를 검증한다.
for (const currentTestScenario of [
  {name:'포트 미사용 시 바로 시작', occupied:false, answer:'', started:true},
  {name:'거절 시 기존 서버 유지', occupied:true, answer:'n\n', started:false},
  {name:'입력 종료 시 기존 서버 유지', occupied:true, answer:'', started:false},
  {name:'동의 시 기존 서버 종료 후 시작', occupied:true, answer:'yes\n', started:true},
]) {
  test(currentTestScenario.name, async () => {
    const currentFixtureRoot=await mkdtemp(join(tmpdir(),'frontend-port-'));
    const currentServerProcess=spawn('sleep',['60']);
    const currentServerExit=once(currentServerProcess,'exit');
    try {
      await mkdir(join(currentFixtureRoot,'scripts'));
      await mkdir(join(currentFixtureRoot,'node_modules/.bin'),{recursive:true});
      await mkdir(join(currentFixtureRoot,'bin'));
      await copyFile(new URL('../scripts/local_frontend_run.sh',import.meta.url),join(currentFixtureRoot,'scripts/local_frontend_run.sh'));
      await writeFile(join(currentFixtureRoot,'scripts/script_logging.sh'),'SCRIPT_LOG_ROOT="'+currentFixtureRoot+'"\n');
      await writeFile(join(currentFixtureRoot,'node_modules/.bin/vite'),'#!/bin/sh\n',{mode:0o755});
      await writeFile(join(currentFixtureRoot,'bin/npm'),'#!/bin/sh\ntouch "'+currentFixtureRoot+'/started"\n',{mode:0o755});
      await writeFile(join(currentFixtureRoot,'bin/lsof'),currentTestScenario.occupied
        ? '#!/bin/sh\nif kill -0 '+currentServerProcess.pid+' 2>/dev/null; then echo '+currentServerProcess.pid+'; else exit 1; fi\n'
        : '#!/bin/sh\nexit 1\n',{mode:0o755});
      const currentRunProcess=spawn('bash',[join(currentFixtureRoot,'scripts/local_frontend_run.sh')],{
        env:{...process.env,PATH:join(currentFixtureRoot,'bin')+':'+process.env.PATH},stdio:['pipe','pipe','pipe'],
      });
      let currentRunOutput='';
      currentRunProcess.stdout.on('data',currentOutputChunk=>{currentRunOutput+=currentOutputChunk;});
      currentRunProcess.stderr.on('data',currentOutputChunk=>{currentRunOutput+=currentOutputChunk;});
      const currentRunExit=once(currentRunProcess,'exit');
      currentRunProcess.stdin.end(currentTestScenario.answer);
      const [currentExitCode]=await currentRunExit;
      assert.equal(currentExitCode,0,currentRunOutput);
      const currentStartRecorded=await access(join(currentFixtureRoot,'started')).then(()=>true,()=>false);
      assert.equal(currentStartRecorded,currentTestScenario.started,currentRunOutput);
      if(currentTestScenario.occupied&&currentTestScenario.started){
        await currentServerExit;
        assert.equal(currentServerProcess.signalCode,'SIGTERM');
        assert.match(currentRunOutput,/정상 종료 요청/);
      }else{
        assert.equal(currentServerProcess.exitCode,null);
        assert.equal(currentServerProcess.signalCode,null);
      }
      if(currentTestScenario.occupied)assert.match(currentRunOutput,/\[y\/N\]/);
    } finally {
      if(currentServerProcess.exitCode===null&&currentServerProcess.signalCode===null)currentServerProcess.kill();
      await currentServerExit;
      await rm(currentFixtureRoot,{recursive:true,force:true});
    }
  });
}
