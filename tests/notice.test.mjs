import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:"export * from './src/client/notice'; export * from './src/client/response';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {noticeText,LocalizedError,ApiError,readApiResponse}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('동일한 저장 안내를 언어 변경 후 다시 해석한다',()=>{
 const notice={key:'network.connected'};
 assert.equal(noticeText(notice,'ko',()=> '연결됨'),'연결됨');
 assert.equal(noticeText(notice,'en',()=> 'Connected'),'Connected');
 assert.equal(noticeText(new LocalizedError('app.loggedOut'),'en',key=>key),'app.loggedOut');
 assert.equal(noticeText(new Error('legacy'),'en',()=>''),'legacy');
});
test('실제 HTTP 오류 객체는 검증된 번역 쌍과 기존 message 계약을 보존한다',async()=>{
 let captured;
 try {await readApiResponse(new Response(JSON.stringify({code:'DENIED',messages:{ko:'거절',en:'Denied'}}),{status:403,headers:{'content-type':'application/json'}}),'ko');}catch(e){captured=e;}
 assert.equal(captured.message,'거절');
 assert.equal(noticeText(captured,'en',()=>''),'Denied');
 const pair={ko:'원문',en:'Original'};
 const error=new ApiError('TEST',pair.ko,400,pair);pair.en='mutated';
 assert.equal(noticeText(error,'en',()=>''),'Original');
 assert.equal(noticeText(new ApiError('OLD','old',400),'en',()=>''),'old');
 assert.throws(()=>new ApiError('BAD','bad',400,{ko:'누락'}));
});
test('JSON이 비어 있는 서버 오류도 재요청 없이 언어를 바꿀 수 있다',async()=>{
 let captured;
 try {await readApiResponse(new Response('',{status:502}),'ko');}catch(e){captured=e;}
 assert.match(noticeText(captured,'ko',()=>''),/서버 응답 오류/);
 assert.match(noticeText(captured,'en',()=>''),/Server response error/);
});
