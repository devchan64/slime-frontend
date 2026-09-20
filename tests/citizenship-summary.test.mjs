import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledSummaryBundle=await build({entryPoints:['src/client/citizenshipSummary.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {validateCitizenshipSummary}=await import(`data:text/javascript;base64,${Buffer.from(compiledSummaryBundle.outputFiles[0].text).toString('base64')}`);
const currentSummaryFixture={records:[{cityId:'iseulon',cityName:'이슬온',source:'initial',startsAt:10,expiresAt:20,status:'VALID'}]};
test('시민권의 발급 이력과 빈 목록을 검증한다',()=>{
 assert.deepEqual(validateCitizenshipSummary(currentSummaryFixture),currentSummaryFixture);
 assert.deepEqual(validateCitizenshipSummary({records:[]}),{records:[]});
 for(const currentStatusName of ['PENDING','EXPIRED'])assert.equal(validateCitizenshipSummary({records:[{...currentSummaryFixture.records[0],status:currentStatusName}]}).records[0].status,currentStatusName);
});
test('잘못된 시민권 기간·출처·상태·알 수 없는 정보를 거절한다',()=>{
 for(const currentInvalidFields of [{expiresAt:10},{startsAt:-1},{source:'free'},{status:'UNKNOWN'},{cityName:''},{expiresAt:'20'},{characterId:'other'}]){
  assert.throws(()=>validateCitizenshipSummary({records:[{...currentSummaryFixture.records[0],...currentInvalidFields}]}));
 }
});
