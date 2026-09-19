import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/client/credentials.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {registrationIssue}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('가입 비밀번호는 문자 종류별 필수 포함 조건이 없다',()=>{
  for(const password of ['a','ABC','123','!@#','abc1!','ABC1!','Abcd!','Abcd1','a'.repeat(128)]) {
    assert.equal(registrationIssue('user1',password),null);
  }
});
test('빈 값·허용 문자·길이와 아이디 제한은 유지한다',()=>{
  for(const password of ['', 'a b', 'abc\n', '한글', '🙂', 'a'.repeat(129)]) {
    assert.equal(registrationIssue('user1',password), 'auth.invalidPassword');
  }
  for(const user of ['', 'USER', 'user name', '한글', 'a'.repeat(41)]) {
    assert.equal(registrationIssue(user,'abc'), 'auth.invalidUsername');
  }
});
