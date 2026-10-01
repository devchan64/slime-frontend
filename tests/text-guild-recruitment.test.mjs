import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
function createRecruitmentClient(){
 const currentTextClient=new TextClient('http://localhost');
 currentTextClient.tokens={user_id:'owner',access_token:'token'};
 currentTextClient.accept({protocolVersion:1,generation:1,epoch:1,cursor:0,me:{id:'owner',version:1,mode:'FIELD',position:{column:1,row:1}},
  map:{id:'iseulon',buildings:[{facilityId:'iseulon-guild',facilityKind:'guild',entrance:{column:1,row:1}}]}});
 return currentTextClient;
}
test('모집 등록 영수증 이후 조회가 실패하면 POST 대신 조회만 복구한다',async()=>{
 const currentTextClient=createRecruitmentClient();
 const currentRequests=[];
 let currentSnapshotCount=0;
 currentTextClient.request=async(currentPath,currentBody)=>{
  currentRequests.push({path:currentPath,body:currentBody});
  if(currentBody){assert.deepEqual(currentBody,{registered:true,expectedVersion:1});return {cityId:'iseulon',registered:true,characterVersion:2};}
  if(++currentSnapshotCount<3)throw new TypeError('조회 실패');
  return {...currentTextClient.state,cursor:1,me:{...currentTextClient.state.me,version:2}};
 };
 await assert.rejects(currentTextClient.execute('recruitment register iseulon-guild'),/retry/);
 assert.match(await currentTextClient.execute('retry'),/등록 완료/);
 assert.equal(currentRequests.filter(currentRequest=>currentRequest.body).length,1);
 assert.equal(currentTextClient.state.me.version,2);
});
test('모집 목록은 읽기 전용이며 해제는 원격에서도 기존 계약 유지 안내를 한다',async()=>{
 const currentTextClient=createRecruitmentClient();
 currentTextClient.request=async()=>({characterVersion:1,entries:[{cityId:'iseulon',registeredAt:100}]});
 assert.match(await currentTextClient.execute('recruitment list'),/iseulon.*등록/);
 currentTextClient.state.map={id:'meadow'};
 currentTextClient.request=async(currentPath,currentBody)=>currentBody?{cityId:'iseulon',registered:false,characterVersion:2}:
  {...currentTextClient.state,cursor:1,me:{...currentTextClient.state.me,version:2}};
 assert.match(await currentTextClient.execute('recruitment unregister iseulon iseulon-guild'),/기존 대여 계약은 유지/);
});
test('원격 등록·잘못된 명령과 조회 중 세션 교체는 거절한다',async()=>{
 const currentTextClient=createRecruitmentClient();
 for(const currentCommand of ['recruitment','recruitment list extra','recruitment unregister iseulon','recruitment register ../guild'])await assert.rejects(currentTextClient.execute(currentCommand));
 currentTextClient.state.me.position.column=2;
 await assert.rejects(currentTextClient.execute('recruitment register iseulon-guild'),/입구/);
 currentTextClient.request=async()=>{currentTextClient.tokens={user_id:'other'};return {characterVersion:1,entries:[]};};
 await assert.rejects(currentTextClient.execute('recruitment list'),/상태가 변경/);
});
