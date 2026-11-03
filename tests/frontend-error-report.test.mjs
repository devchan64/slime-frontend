import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('프론트 오류는 인증된 경우 전송하고 URL 제거·빈도 제한·전송 실패를 처리한다',async()=>{
 const currentSource=ts.createSourceFile('App.tsx',await readFile('src/ui/App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const currentFunction=currentSource.statements.find(currentNode=>ts.isFunctionDeclaration(currentNode)&&currentNode.name?.text==='reportFrontendError');
 assert.ok(currentFunction);
 const currentJavascript=ts.transpileModule('let lastFrontendErrorTime=0;\n'+currentFunction.getText(currentSource),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const currentReports=[];let currentClock=10000;
 const currentClient={tokens:{},request(currentPath,currentPayload){currentReports.push({currentPath,currentPayload});return Promise.reject(new Error('서버 연결 실패'));}};
 const currentContext={client:currentClient,Date:{now:()=>currentClock},Error};
 vm.runInNewContext(currentJavascript+'\nthis.report=reportFrontendError;',currentContext);
 currentContext.report('terrain-validation',new Error('타일 오류 https://example.test/private'),'lantern-wood');
 assert.equal(currentReports.length,1);assert.equal(currentReports[0].currentPath,'/v1/client-errors');
 assert.equal(currentReports[0].currentPayload.message,'타일 오류 [주소 제거]');assert.equal(currentReports[0].currentPayload.mapId,'lantern-wood');
 currentContext.report('runtime',new Error('반복'),'lantern-wood');assert.equal(currentReports.length,1);
 currentClock+=5000;currentClient.tokens=null;currentContext.report('runtime',new Error('미인증'),'lantern-wood');assert.equal(currentReports.length,1);
 currentClient.tokens={};currentContext.report('runtime',new Error('복구'),'lantern-wood');assert.equal(currentReports.length,2);
 await new Promise(resolveCurrentPromise=>setImmediate(resolveCurrentPromise));
});
