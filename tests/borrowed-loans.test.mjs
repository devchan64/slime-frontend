import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const loanModuleBuild = await build({entryPoints:['src/client/borrowedLoans.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseBorrowedLoanPage,calculateLoanRemainingSeconds} = await import(`data:text/javascript;base64,${Buffer.from(loanModuleBuild.outputFiles[0].text).toString('base64')}`);
function createLoanResponse() {
  return {serverTime:100, nextCursor:null, entries:[{id:'loan-one',name:'모험가',startedAt:10,expiresAt:200,
    expired:false,inBattle:false,hp:0,maxHp:25,attributes:{body:1},skills:{physical:1,learned:0}}]};
}
test('HP 0과 새 스킬 0레벨, 만료된 진행 전투를 표시할 수 있다',()=>{
  const receivedLoanPage=createLoanResponse();
  assert.deepEqual(parseBorrowedLoanPage(receivedLoanPage),receivedLoanPage);
  receivedLoanPage.entries[0].expired=true;
  receivedLoanPage.entries[0].inBattle=true;
  assert.equal(parseBorrowedLoanPage(receivedLoanPage).entries[0].hp,0);
});
test('깨진 HP, 레벨, 기한, 상태와 중복 대여 ID를 거절한다',()=>{
  for (const invalidLoanPatch of [{hp:-1},{hp:26},{hp:1.5},{maxHp:0},{expiresAt:10},{inBattle:'true'},{healthRecoveryPending:'true'},{healthRecoveryPending:null},{skills:{physical:-1}},{attributes:[]}]) {
    const receivedLoanPage=createLoanResponse();
    Object.assign(receivedLoanPage.entries[0],invalidLoanPatch);
    assert.throws(()=>parseBorrowedLoanPage(receivedLoanPage),/대여/);
  }
  const receivedLoanPage=createLoanResponse();
  receivedLoanPage.entries.push({...receivedLoanPage.entries[0]});
  assert.throws(()=>parseBorrowedLoanPage(receivedLoanPage),/대여/);
  assert.throws(()=>parseBorrowedLoanPage({serverTime:NaN,entries:[],nextCursor:null}),/대여/);
});
test('남은 시간은 서버 시각과 단조 시계로 계산하고 만료 후 0으로 제한한다',()=>{
  assert.equal(calculateLoanRemainingSeconds(200,100,60000),40);
  assert.equal(calculateLoanRemainingSeconds(200,100,100000),0);
  assert.equal(calculateLoanRemainingSeconds(200,100,200000),0);
});

test('회복 대기는 HP 비율로 추정하지 않고 서버 상태를 보존한다',()=>{
  const receivedLoanPage=createLoanResponse();
  receivedLoanPage.entries[0].hp=2;
  receivedLoanPage.entries[0].healthRecoveryPending=true;
  assert.equal(parseBorrowedLoanPage(receivedLoanPage).entries[0].healthRecoveryPending,true);
  receivedLoanPage.entries[0].healthRecoveryPending=false;
  assert.equal(parseBorrowedLoanPage(receivedLoanPage).entries[0].healthRecoveryPending,false);
});

test('CP 판정은 등록된 상태만 허용하고 이전 API 누락과 구분한다',()=>{
 for(const currentCpStatus of ['ELIGIBLE','OUT_OF_RANGE','MIGRATION_REQUIRED']){
  const currentResponseFixture=createLoanResponse();currentResponseFixture.entries[0].partyCpStatus=currentCpStatus;
  assert.equal(parseBorrowedLoanPage(currentResponseFixture).entries[0].partyCpStatus,currentCpStatus);
 }
 for(const currentInvalidStatus of [true,null,'AVAILABLE']){
  const currentResponseFixture=createLoanResponse();currentResponseFixture.entries[0].partyCpStatus=currentInvalidStatus;
  assert.throws(()=>parseBorrowedLoanPage(currentResponseFixture));
 }
 assert.equal(parseBorrowedLoanPage(createLoanResponse()).entries[0].partyCpStatus,undefined);
});
