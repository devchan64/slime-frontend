import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const MISSION_TEST_IDENTIFIER='11111111-1111-4111-8111-111111111111';
function createMissionState(currentCharacterVersion=4){return {protocolVersion:1,generation:1,epoch:1,cursor:currentCharacterVersion,me:{id:'hero',version:currentCharacterVersion,mode:'FIELD'}};}
function createMissionRecord(){return {characterId:'hero',requestId:MISSION_TEST_IDENTIFIER,status:'ACTIVE',acceptedAt:100,quote:{definitionSnapshot:{missionId:'refine-hide',cityId:'iseulon',receiverNpcId:'merchant',collectionId:'hide',grade:'low',quantity:2,rewardP:10},deposit:{depositP:96},rewardP:10,refining:{collectionId:'hide',inputQuantity:6,outputQuantity:2,grade:'low',costP:12,durationSeconds:60,outputMaterial:{name:'가죽'}}}};}
function createMissionPage(){return {characterVersion:4,serverTime:110,nextOffset:null,entries:[createMissionRecord()]};}
function createMissionClient(currentResponseQueue){
 const currentRequestRecords=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  currentRequestRecords.push({url:currentRequestUrl,body:currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined});
  assert.ok(currentResponseQueue.length,'예기치 않은 요청');
  const currentResponseRecord=currentResponseQueue.shift();
  if(currentResponseRecord instanceof Error)throw currentResponseRecord;
  if(typeof currentResponseRecord==='function')return new Response(JSON.stringify(currentResponseRecord(currentTextClient)));
  return new Response(JSON.stringify(currentResponseRecord));
 }});
 currentTextClient.accept(createMissionState());return {currentTextClient,currentRequestRecords};
}
test('기록 조회는 담보·보수·위탁량과 무환불 조건을 표시하고 변경하지 않는다',async()=>{
 const {currentTextClient,currentRequestRecords}=createMissionClient([createMissionPage()]);
 const currentOutputText=await currentTextClient.execute('missions list');
 assert.match(currentOutputText,/위탁 hide × 6/);assert.match(currentOutputText,/담보 96P.*정제비 12P.*완료 보수 10P/);
 assert.match(currentOutputText,/담보금은 반환되지 않으며/);
 assert.equal(currentRequestRecords[0].body,undefined);assert.ok(currentRequestRecords[0].url.endsWith('?offset=0'));
});
test('취소 응답 유실은 동일 본문으로 재시도하고 담보 무환불을 안내한다',async()=>{
 const currentReceiptRecord={...createMissionRecord(),status:'CANCELLED',cancelledAt:111};
 const {currentTextClient,currentRequestRecords}=createMissionClient([createMissionPage(),new TypeError('응답 유실'),new TypeError('응답 유실'),{receipt:currentReceiptRecord,state:createMissionState(5)}]);
 await currentTextClient.execute('missions list');
 await assert.rejects(currentTextClient.execute('missions cancel '+MISSION_TEST_IDENTIFIER),/retry/);
 assert.match(await currentTextClient.execute('retry'),/취소했습니다.*담보금은 반환되지/);
 assert.deepEqual(currentRequestRecords.slice(1).map(currentRequestRecord=>currentRequestRecord.body),Array(3).fill({expectedVersion:4}));
 assert.ok(currentRequestRecords[1].url.endsWith('/'+MISSION_TEST_IDENTIFIER+'/cancel'));
 assert.equal(currentTextClient.state.me.version,5);
});
test('잘못된 임무·타인·중복·종료 시각·페이지를 목록으로 채택하지 않는다',async()=>{
 const currentBasePage=createMissionPage();
 for(const currentInvalidPage of [{...currentBasePage,entries:[{...createMissionRecord(),characterId:'other'}]},
  {...currentBasePage,entries:[createMissionRecord(),createMissionRecord()]},
  {...currentBasePage,entries:[{...createMissionRecord(),status:'CANCELLED',cancelledAt:99}]},
  {...currentBasePage,nextOffset:50},{...currentBasePage,characterVersion:3}]){
  const {currentTextClient}=createMissionClient([currentInvalidPage]);
  await assert.rejects(currentTextClient.execute('missions list'));
  await assert.rejects(currentTextClient.execute('missions cancel '+MISSION_TEST_IDENTIFIER),/먼저 확인/);
 }
});
test('조회 없이 또는 상태·세션 변경 후 취소하지 않는다',async()=>{
 const {currentTextClient,currentRequestRecords}=createMissionClient([createMissionPage()]);
 await assert.rejects(currentTextClient.execute('missions cancel '+MISSION_TEST_IDENTIFIER),/먼저 확인/);
 await currentTextClient.execute('missions list');currentTextClient.accept(createMissionState(5));
 await assert.rejects(currentTextClient.execute('missions cancel '+MISSION_TEST_IDENTIFIER),/먼저 확인/);
 assert.equal(currentRequestRecords.length,1);
 const {currentTextClient:currentChangedClient}=createMissionClient([currentClient=>{currentClient.accept({...createMissionState(),generation:2});return createMissionPage();}]);
 await assert.rejects(currentChangedClient.execute('missions list'),/상태가 바뀌/);
});
test('취소 영수증의 다른 대상·보수 변조는 상태에 적용하지 않는다',async()=>{
 const currentWrongReceipt={...createMissionRecord(),status:'CANCELLED',cancelledAt:111,requestId:'22222222-2222-4222-8222-222222222222'};
 const currentWrongResponse={receipt:currentWrongReceipt,state:createMissionState(5)};
 const {currentTextClient}=createMissionClient([createMissionPage(),currentWrongResponse,currentWrongResponse]);
 await currentTextClient.execute('missions list');
 await assert.rejects(currentTextClient.execute('missions cancel '+MISSION_TEST_IDENTIFIER),/retry/);
 assert.equal(currentTextClient.state.me.version,4);
});
test('잘못된 인수와 조우 중 취소는 서버에 보내지 않는다',async()=>{
 const {currentTextClient,currentRequestRecords}=createMissionClient([createMissionPage()]);
 for(const currentCommandText of ['missions','missions list -1','missions list 1.5','missions list 9007199254740992','missions cancel ../other','missions list 0 extra'])await assert.rejects(currentTextClient.execute(currentCommandText));
 assert.equal(currentRequestRecords.length,0);
 await currentTextClient.execute('missions list');currentTextClient.state.reservation={id:'encounter'};
 await assert.rejects(currentTextClient.execute('missions cancel '+MISSION_TEST_IDENTIFIER),/조우/);
 assert.equal(currentRequestRecords.length,1);
});
