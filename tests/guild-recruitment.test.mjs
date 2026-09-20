import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentCompiledBundle=await build({entryPoints:['src/client/guildRecruitment.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseGuildRecruitmentPage,validateGuildRegistrationResult}=await import(`data:text/javascript;base64,${Buffer.from(currentCompiledBundle.outputFiles[0].text).toString('base64')}`);
test('모집 상태의 중복 도시와 잘못된 버전·시간을 거절한다',()=>{
 const currentPageFixture={characterVersion:2,entries:[{cityId:'iseulon',registeredAt:10}]};
 assert.deepEqual(parseGuildRecruitmentPage(currentPageFixture),currentPageFixture);
 for(const currentInvalidFixture of [{...currentPageFixture,characterVersion:true},{...currentPageFixture,entries:[...currentPageFixture.entries,...currentPageFixture.entries]},
  {...currentPageFixture,entries:[{cityId:'iseulon',registeredAt:NaN}]}])assert.throws(()=>parseGuildRecruitmentPage(currentInvalidFixture));
});
test('등록 변경 응답은 요청한 도시와 상태에 일치해야 한다',()=>{
 const currentResultFixture={cityId:'iseulon',registered:true,characterVersion:3};
 validateGuildRegistrationResult(currentResultFixture,'iseulon',true);
 assert.throws(()=>validateGuildRegistrationResult(currentResultFixture,'other',true));
 assert.throws(()=>validateGuildRegistrationResult(currentResultFixture,'iseulon',false));
});
