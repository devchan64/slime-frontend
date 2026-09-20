import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: actionCutinBuildOutputs } = await build({ entryPoints: ['src/ui/actionCutins.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { ActionCutinTracker, appendActionCutinQueue, readActionCutinSetting, findActionCutinPresentation, ACTION_CUTIN_SETTING_KEY, ACTION_CUTIN_LEGACY_KEY, ACTION_CUTIN_ACTION_PRESENTATIONS } = await import(`data:text/javascript;base64,${Buffer.from(actionCutinBuildOutputs[0].text).toString('base64')}`);
function createActionCutinEvent(actionSequenceValue, actionTypeValue = 'ATTACK') {
  return { battleId: 'battle-one', actionId: `battle-one:${actionSequenceValue}`, sequence: actionSequenceValue, actionType: actionTypeValue, unitId:'actor-one', actorName:'모험가', skillId:actionTypeValue==='SKILL'?'physical':null, appearance:{kind:'monster',group:'slime'} };
}
function createBattleSnapshot(battleVersionValue, incomingActionCutinEvents = []) {
  return { me: { id: 'player-one', lastResult: null }, battle: { id: 'battle-one', version: battleVersionValue, log: incomingActionCutinEvents.map(actionCutinEventRecord => ({ stillshot: actionCutinEventRecord })) } };
}
test('첫 스냅샷은 재생하지 않고 확정된 일반 공격만 중복 없이 순서대로 표시한다', () => {
  const actionCutinEventTracker = new ActionCutinTracker();
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(3, [createActionCutinEvent(3)])), []);
  const nextBattleSnapshot = createBattleSnapshot(5, [createActionCutinEvent(3), createActionCutinEvent(4), createActionCutinEvent(5)]);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(nextBattleSnapshot).map(actionCutinEventRecord => actionCutinEventRecord.sequence), [4, 5]);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(nextBattleSnapshot), []);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(3)), []);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(nextBattleSnapshot), []);
});
test('전투 종료 스냅샷에서 마지막 공격을 회수하고 재접속·다른 캐릭터에서는 재생하지 않는다', () => {
  const actionCutinEventTracker = new ActionCutinTracker();
  actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(5));
  const finalBattleSnapshot = { me: { id: 'player-one', lastResult: { battleId: 'battle-one', stillshots: [createActionCutinEvent(4), createActionCutinEvent(6)] } }, battle: null };
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(finalBattleSnapshot), [createActionCutinEvent(6)]);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(finalBattleSnapshot), []);
  assert.deepEqual(new ActionCutinTracker().collectNewActionCutins(finalBattleSnapshot), []);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins({ ...finalBattleSnapshot, me: { ...finalBattleSnapshot.me, id: 'player-two' } }), []);
});
test('대기열은 현재 연출과 최신 행동을 유지하며 최대 4개로 제한한다', () => {
  assert.deepEqual(appendActionCutinQueue([createActionCutinEvent(1)], [2,3,4,5,6].map(actionSequenceValue => createActionCutinEvent(actionSequenceValue))).map(actionCutinEventRecord => actionCutinEventRecord.sequence), [1,4,5,6]);
});
test('기본 3초, 시간 저장, 기존 끄기 이관과 잘못된 설정을 검증한다', () => {
  assert.equal(readActionCutinSetting({ getItem: () => null }), 3);
  for (const durationSettingValue of [0, 1, 2, 3]) {
    assert.equal(readActionCutinSetting({ getItem: storageLookupKey => storageLookupKey === ACTION_CUTIN_SETTING_KEY ? String(durationSettingValue) : 'false' }), durationSettingValue);
  }
  for (const [legacySettingValue, expectedDurationSeconds] of [['false', 0], ['true', 3]]) {
    assert.equal(readActionCutinSetting({ getItem: storageLookupKey => storageLookupKey === ACTION_CUTIN_LEGACY_KEY ? legacySettingValue : null }), expectedDurationSeconds);
  }
  for (const invalidSettingValue of ['invalid', '4', '-1', '1.5', '', 'true']) {
    assert.throws(() => readActionCutinSetting({ getItem: () => invalidSettingValue }), /설정/);
  }
});

test('스킬 액션 컷인은 진행 전투와 종료 결과 모두에서 표시하지 않는다', () => {
  const actionCutinEventTracker = new ActionCutinTracker();
  actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(1));
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(3, [createActionCutinEvent(2, 'SKILL'), createActionCutinEvent(3)])), [createActionCutinEvent(3)]);
  const finalBattleSnapshot = { me: { id: 'player-one', lastResult: { battleId: 'battle-one', stillshots: [createActionCutinEvent(4, 'SKILL'), createActionCutinEvent(5)] } }, battle: null };
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(finalBattleSnapshot), [createActionCutinEvent(5)]);
});

test('명령별 표시 정의는 현재 일반 공격만 활성화한다', () => {
  assert.deepEqual(findActionCutinPresentation('ATTACK'), { translationMessageKey: 'cutins.attack' });
  for (const unregisteredActionType of ['SKILL', 'MOVE', 'GUARD', 'END_TURN', '__proto__']) {
    assert.equal(findActionCutinPresentation(unregisteredActionType), undefined);
  }
});

test('새 명령 등록 시 공통 이벤트 추적과 표시 정의를 재사용한다', () => {
  ACTION_CUTIN_ACTION_PRESENTATIONS.MOVE = { translationMessageKey: 'test.move' };
  try {
    const actionCutinEventTracker = new ActionCutinTracker();
    actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(1));
    assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(2, [createActionCutinEvent(2, 'MOVE')])), [createActionCutinEvent(2, 'MOVE')]);
    assert.equal(findActionCutinPresentation('MOVE').translationMessageKey, 'test.move');
  } finally { delete ACTION_CUTIN_ACTION_PRESENTATIONS.MOVE; }
});


test('종료 결과 이후 높은 순번의 지연 이벤트도 추가하지 않고 다음 전투는 새로 추적한다', () => {
  const actionCutinEventTracker = new ActionCutinTracker();
  actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(1));
  const finalBattleSnapshot = {me:{id:'player-one',lastResult:{battleId:'battle-one',stillshots:[createActionCutinEvent(2)]}},battle:null};
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(finalBattleSnapshot), [createActionCutinEvent(2)]);
  finalBattleSnapshot.me.lastResult.stillshots.push(createActionCutinEvent(3));
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(finalBattleSnapshot), []);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(4,[createActionCutinEvent(4)])), []);
  const nextBattleSnapshot = createBattleSnapshot(1);
  nextBattleSnapshot.battle.id = 'battle-two';
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(nextBattleSnapshot), []);
  const nextBattleEvent = {...createActionCutinEvent(2),battleId:'battle-two',actionId:'battle-two:2'};
  nextBattleSnapshot.battle.version = 2;
  nextBattleSnapshot.battle.log = [{stillshot:nextBattleEvent}];
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(nextBattleSnapshot), [nextBattleEvent]);
});

test('다른 전투의 결과는 종료 기준으로 사용하지 않고 입력 내부 중복은 순서대로 정리한다', () => {
  const actionCutinEventTracker = new ActionCutinTracker();
  actionCutinEventTracker.collectNewActionCutins(createBattleSnapshot(1));
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins({me:{id:'player-one',lastResult:{battleId:'old-battle',stillshots:[]}},battle:null}),[]);
  const nextBattleSnapshot = createBattleSnapshot(3,[createActionCutinEvent(3),createActionCutinEvent(2),createActionCutinEvent(2)]);
  assert.deepEqual(actionCutinEventTracker.collectNewActionCutins(nextBattleSnapshot),[createActionCutinEvent(2),createActionCutinEvent(3)]);
});

test('잘못된 컷인 계약은 순번을 소비하지 않고 정상 재수신을 허용한다', () => {
  const currentInvalidChanges = [
    {sequence:'2'}, {sequence:Infinity}, {sequence:0}, {sequence:2.5},
    {actionId:'unrelated'}, {unitId:''}, {actorName:null}, {skillId:'physical'},
    {appearance:{kind:'unknown'}}, {appearance:{kind:'monster',group:3}},
    {appearance:{kind:'character',groups:{costume:'default',hair:'default'}}},
    {appearance:{kind:'character',groups:{costume:'default',hair:'default',face:'default',extra:1}}},
    {contractVersion:2}, {extra:'private-data'},
  ];
  for (const currentInvalidChange of currentInvalidChanges) {
    const currentEventTracker=new ActionCutinTracker();
    currentEventTracker.collectNewActionCutins(createBattleSnapshot(1));
    assert.throws(()=>currentEventTracker.collectNewActionCutins(createBattleSnapshot(2,[{...createActionCutinEvent(2),...currentInvalidChange}])),/액션 컷인/);
    assert.deepEqual(currentEventTracker.collectNewActionCutins(createBattleSnapshot(2,[createActionCutinEvent(2)])),[createActionCutinEvent(2)]);
  }
});

test('종료 이벤트도 엄격히 검사하며 반환된 컷인은 수신 원본과 분리한다',()=>{
  const currentEventTracker=new ActionCutinTracker();
  currentEventTracker.collectNewActionCutins(createBattleSnapshot(1));
  const currentResultState={me:{id:'player-one',lastResult:{battleId:'battle-one',stillshots:[{...createActionCutinEvent(2),appearance:null}]}},battle:null};
  assert.throws(()=>currentEventTracker.collectNewActionCutins(currentResultState),/액션 컷인/);
  currentResultState.me.lastResult.stillshots=[createActionCutinEvent(2)];
  const currentReturnedEvents=currentEventTracker.collectNewActionCutins(currentResultState);
  currentReturnedEvents[0].appearance.group='beast';
  assert.equal(currentResultState.me.lastResult.stillshots[0].appearance.group,'slime');
});
