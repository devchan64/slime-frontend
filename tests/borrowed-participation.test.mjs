import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBundleResult=await build({entryPoints:['src/client/borrowedParticipation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseBorrowedParticipation}=await import(`data:text/javascript;base64,${Buffer.from(currentBundleResult.outputFiles[0].text).toString('base64')}`);
test('참가와 제외 명단을 복사하고 중복·미등록 사유를 거절한다',()=>{
 const currentResponseRecord={serverTime:100,participants:[{loanId:'a',name:'아린'}],excluded:[{loanId:'b',name:'보라',reason:'EXPIRED'}]};
 const currentParsedRecord=parseBorrowedParticipation(currentResponseRecord);
 assert.deepEqual(currentParsedRecord,currentResponseRecord);
 currentResponseRecord.participants[0].name='변경';assert.equal(currentParsedRecord.participants[0].name,'아린');
 assert.throws(()=>parseBorrowedParticipation({...currentResponseRecord,excluded:[{loanId:'a',name:'중복',reason:'EXPIRED'}]}));
 assert.throws(()=>parseBorrowedParticipation({...currentResponseRecord,excluded:[{loanId:'b',name:'손상',reason:'INVALID'}]}));
 assert.throws(()=>parseBorrowedParticipation({...currentResponseRecord,serverTime:NaN}));
});
