import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const currentCatalogFixture={version:2,defaultCostumeId:'default',entries:[{costumeId:'default',valueP:25,version:1,designId:'default',designVersion:1,nameTranslations:{ko:'기본 의상',en:'Default'},descriptionTranslations:{ko:'전체 디자인\n설명',en:'Details'}}]};
test('코스튬 조회는 명령 복구 대기 중에도 읽기만 수행하고 상태를 보존한다',async()=>{
 const currentRequestCalls=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{currentRequestCalls.push({url:currentRequestUrl,options:currentRequestOptions});return new Response(JSON.stringify(currentCatalogFixture));}});
 currentTextClient.state={me:{id:'hero',version:3}};currentTextClient.pendingCommandRequest={path:'pending'};
 const currentOriginalState=structuredClone(currentTextClient.state);
 const currentCatalogText=await currentTextClient.execute('costumes');
 assert.match(currentCatalogText,/기본 의상 \[default\]/);assert.match(currentCatalogText,/디자인 default v1/);assert.match(currentCatalogText,/전체 디자인 설명/);
 assert.match(currentCatalogText,/표준 가치 25p/);
 assert.deepEqual(currentTextClient.state,currentOriginalState);assert.deepEqual(currentTextClient.pendingCommandRequest,{path:'pending'});
 assert.equal(currentRequestCalls.length,1);assert.ok(currentRequestCalls[0].url.endsWith('/v2/costumes'));assert.equal(currentRequestCalls[0].options.method,'GET');assert.equal(currentRequestCalls[0].options.body,undefined);
 await assert.rejects(currentTextClient.execute('costumes equip default'),/조회하세요/);assert.equal(currentRequestCalls.length,1);
});

function createOwnedCostumeClient(currentResponseFactory){
 const currentRequestRecords=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestRecords.push({url:currentRequestUrl,options:currentRequestOptions});
  return new Response(JSON.stringify(await currentResponseFactory()));
 }});
 currentTextClient.tokens={user_id:'hero',access_token:'test-access'};
 currentTextClient.state={generation:2,me:{id:'hero',version:3}};
 return {currentTextClient,currentRequestRecords};
}
const currentOwnedFixture={characterVersion:3,defaultCostumeId:'default',entries:[{...currentCatalogFixture.entries[0],source:'parcel',acquiredAt:100}]};
for(const currentSourceKind of ['parcel','shop'])test(`보유 코스튬 ${currentSourceKind} 출처와 획득 정의를 읽기 전용으로 표시한다`,async()=>{
 const currentInventoryResponse=structuredClone(currentOwnedFixture);
 currentInventoryResponse.entries[0].source=currentSourceKind;
 currentInventoryResponse.entries[0].nameTranslations.ko='기본\u001b[31m 의상';
 const {currentTextClient,currentRequestRecords}=createOwnedCostumeClient(()=>currentInventoryResponse);
 currentTextClient.pendingCommandRequest={path:'pending'};
 const currentOriginalState=structuredClone(currentTextClient.state);
 const currentOwnedOutput=await currentTextClient.execute('costumes owned');
 assert.match(currentOwnedOutput,currentSourceKind==='parcel'?/획득 소포/:/획득 상점/);
 assert.match(currentOwnedOutput,/1970-01-01T00:01:40.000Z/);
 assert.match(currentOwnedOutput,/표준 가치 25p/);
 assert.match(currentOwnedOutput,/전체 디자인 설명/);
 assert.doesNotMatch(currentOwnedOutput,/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
 assert.deepEqual(currentTextClient.state,currentOriginalState);
 assert.deepEqual(currentTextClient.pendingCommandRequest,{path:'pending'});
 assert.equal(currentRequestRecords.length,1);
 assert.equal(currentRequestRecords[0].url,'http://localhost:18080/v1/characters/me/costumes');
 assert.equal(currentRequestRecords[0].options.method,'GET');
 assert.equal(currentRequestRecords[0].options.body,undefined);
});
test('빈 소유 목록을 기본 디자인 신규 획득으로 표시하지 않는다',async()=>{
 const {currentTextClient}=createOwnedCostumeClient(()=>({...currentOwnedFixture,entries:[]}));
 assert.equal(await currentTextClient.execute('costumes owned'),'보유 코스튬 없음 · 기본 디자인 default 사용 가능');
});
test('캐릭터 세션이 없으면 개인 목록을 요청하지 않는다',async()=>{
 const {currentTextClient,currentRequestRecords}=createOwnedCostumeClient(()=>currentOwnedFixture);
 currentTextClient.tokens=null;
 await assert.rejects(currentTextClient.execute('costumes owned'),/먼저 조회/);
 assert.equal(currentRequestRecords.length,0);
});
test('조회 중 소유자·캐릭터·세대가 바뀌면 개인 응답을 표시하지 않는다',async()=>{
 for(const currentChangeContext of [
  currentTextClient=>{currentTextClient.tokens.user_id='other';},
  currentTextClient=>{currentTextClient.state.me.id='other';},
  currentTextClient=>{currentTextClient.state.generation++;},
  currentTextClient=>{currentTextClient.tokens=null;currentTextClient.state=null;},
 ]){
  let releaseInventoryResponse;
  const currentResponsePromise=new Promise(currentResolveCallback=>{releaseInventoryResponse=currentResolveCallback;});
  const {currentTextClient}=createOwnedCostumeClient(()=>currentResponsePromise);
  const currentPendingResult=currentTextClient.execute('costumes owned');
  currentChangeContext(currentTextClient);
  releaseInventoryResponse(currentOwnedFixture);
  await assert.rejects(currentPendingResult,/세션이 변경/);
 }
});
test('보유 목록의 비공개 필드와 손상된 값은 거절한다',async()=>{
 for(const currentInvalidPatch of [{parcelId:'private'},{source:'drop'},{valueP:0},{acquiredAt:1e20}]){
  const currentResponseFixture=structuredClone(currentOwnedFixture);
  Object.assign(currentResponseFixture.entries[0],currentInvalidPatch);
  const {currentTextClient}=createOwnedCostumeClient(()=>currentResponseFixture);
  await assert.rejects(currentTextClient.execute('costumes owned'));
 }
});
