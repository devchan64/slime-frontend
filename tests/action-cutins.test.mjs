import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: actionCutinBuildOutputs } = await build({ entryPoints: ['src/ui/actionCutins.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { ActionCutinTracker, appendActionCutinQueue, readActionCutinSetting, findActionCutinPresentation, ACTION_CUTIN_SETTING_KEY, ACTION_CUTIN_LEGACY_KEY, ACTION_CUTIN_ACTION_PRESENTATIONS } = await import(`data:text/javascript;base64,${Buffer.from(actionCutinBuildOutputs[0].text).toString('base64')}`);
function createActionCutinEvent(actionSequenceValue, actionTypeValue = 'ATTACK') {
  return { battleId: 'battle-one', actionId: `battle-one:${actionSequenceValue}`, sequence: actionSequenceValue, actionType: actionTypeValue };
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
  const finalBattleSnapshot = { me: { id: 'player-one', lastResult: { stillshots: [createActionCutinEvent(4), createActionCutinEvent(6)] } }, battle: null };
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
  const finalBattleSnapshot = { me: { id: 'player-one', lastResult: { stillshots: [createActionCutinEvent(4, 'SKILL'), createActionCutinEvent(5)] } }, battle: null };
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
