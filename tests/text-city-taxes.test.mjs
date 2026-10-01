import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
import {parseCityTaxResponse} from '../src/client/city-tax-validation.mjs';
const currentStartTimestamp=Date.parse('2026-10-01T04:00:00+09:00')/1000;
const currentTaxFixture={version:1,policyVersion:2,startsAt:currentStartTimestamp,expiresAt:currentStartTimestamp+86400,evaluatedAt:currentStartTimestamp,observedAt:currentStartTimestamp+1,timezone:'Asia/Seoul',refreshHour:4,entries:[{cityId:'iseulon',cityName:'이슬온\n도시',paidCitizenshipCount:3,taxBasisPoints:333}]};
test('세율 조회는 복구 대기 중에도 상태 변경 없이 세율과 한국 시각을 출력한다',async()=>{
 const currentRequestCalls=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{currentRequestCalls.push({url:currentRequestUrl,options:currentRequestOptions});return new Response(JSON.stringify(currentTaxFixture));}});
 currentTextClient.state={me:{id:'hero',version:3}};currentTextClient.pendingCommandRequest={path:'pending'};
 const currentOriginalState=structuredClone(currentTextClient.state);
 const currentTaxText=await currentTextClient.execute('taxes');
 assert.match(currentTaxText,/이슬온 도시 \[iseulon\]: 3.33%/);assert.match(currentTaxText,/04:00/);assert.match(currentTaxText,/KST/);
 assert.deepEqual(currentTextClient.state,currentOriginalState);assert.deepEqual(currentTextClient.pendingCommandRequest,{path:'pending'});
 assert.equal(currentRequestCalls[0].options.method,'GET');assert.ok(currentRequestCalls[0].url.endsWith('/v1/economy/city-taxes'));
 await assert.rejects(currentTextClient.execute('taxes buy'),/조회하세요/);assert.equal(currentRequestCalls.length,1);
});
test('세율 응답의 누락·타입·범위·기간·중복을 거절한다',()=>{
 for(const currentInvalidPatch of [{version:2},{policyVersion:1},{entries:[]},{refreshHour:0},{timezone:'UTC'},{startsAt:NaN},{observedAt:currentStartTimestamp-1},{observedAt:currentStartTimestamp+86400},{expiresAt:currentStartTimestamp+1},{extra:1}])assert.throws(()=>parseCityTaxResponse({...currentTaxFixture,...currentInvalidPatch}));
 for(const currentEntryPatch of [{taxBasisPoints:true},{taxBasisPoints:1001},{paidCitizenshipCount:-1},{paidCitizenshipCount:1.5},{cityId:'../x'},{cityName:''}])assert.throws(()=>parseCityTaxResponse({...currentTaxFixture,entries:[{...currentTaxFixture.entries[0],...currentEntryPatch}]}));
 assert.throws(()=>parseCityTaxResponse({...currentTaxFixture,entries:[currentTaxFixture.entries[0],currentTaxFixture.entries[0]]}));
 const currentCopiedResponse=parseCityTaxResponse(currentTaxFixture);currentCopiedResponse.entries[0].cityName='변경';assert.notEqual(currentCopiedResponse.entries[0].cityName,currentTaxFixture.entries[0].cityName);
});
test('서버 세율 오류를 0% 결과로 바꾸지 않는다',async()=>{
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async()=>new Response(JSON.stringify({code:'CITY_TAX_UNAVAILABLE',message:'세율 조회 불가'}),{status:503})});
 await assert.rejects(currentTextClient.execute('taxes'),/세율 조회 불가/);
});
