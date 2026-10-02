import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateParcelArrivalNotice, watchParcelArrivalNotice, PARCEL_NOTICE_REFRESH_MS} from '../src/client/parcel-notice.mjs';
import {executeParcelCommand} from '../scripts/text-parcel-commands.mjs';
const currentValidNotice = {characterId:'owner', pendingCount:2, serverTime:10};
test('소포 알림은 다른 소유자·잘못된 건수·시각을 거절한다', () => {
  assert.equal(validateParcelArrivalNotice(currentValidNotice,'owner'),2);
  for(const currentInvalidPatch of [{characterId:'other'}, {pendingCount:-1}, {pendingCount:1.5}, {pendingCount:true}, {serverTime:NaN}])
    assert.throws(()=>validateParcelArrivalNotice({...currentValidNotice,...currentInvalidPatch},'owner'));
});
test('알림 조회는 겹치지 않고 정리 후 늦은 응답을 폐기한다',async()=>{
 let currentResolveRequest;
 const currentReceivedCounts=[];
 const currentScheduledTasks=[];
 const currentTimerHost={setTimeout(currentCallback,currentDelay){currentScheduledTasks.push({currentCallback,currentDelay});return 1;},clearTimeout(){}};
 const stopCurrentWatcher=watchParcelArrivalNotice(()=>new Promise(currentResolve=>{currentResolveRequest=currentResolve;}),'owner',currentCount=>currentReceivedCounts.push(currentCount),assert.fail,currentTimerHost);
 assert.equal(currentScheduledTasks.length,0);
 currentResolveRequest(currentValidNotice);await new Promise(setImmediate);
 assert.deepEqual(currentReceivedCounts,[2]);assert.equal(currentScheduledTasks[0].currentDelay,PARCEL_NOTICE_REFRESH_MS);
 void currentScheduledTasks[0].currentCallback();stopCurrentWatcher();
 currentResolveRequest({...currentValidNotice,pendingCount:3});await new Promise(setImmediate);
 assert.deepEqual(currentReceivedCounts,[2]);assert.equal(currentScheduledTasks.length,1);
});
test('전투에서도 계정 보관함 알림을 조회하고 이전 길드 명령은 거절한다',async()=>{
 const currentTextClient={state:{me:{id:'owner',mode:'IN_BATTLE'},generation:1},request:async currentRequestPath=>{assert.equal(currentRequestPath,'/v1/accounts/me/parcels/notice');return currentValidNotice;}};
 assert.match(await executeParcelCommand(currentTextClient,['notice']),/2개.*계정 보관함/);
 await assert.rejects(()=>executeParcelCommand(currentTextClient,['list','iseulon-guild']),/rewards parcels/);
});
test('텍스트 알림은 요청 중 세션 변경을 거절한다',async()=>{
 const currentTextClient={state:{me:{id:'owner'},generation:1},request:async()=>{currentTextClient.state.generation=2;return currentValidNotice;}};
 await assert.rejects(()=>executeParcelCommand(currentTextClient,['notice']),/세션/);
});
