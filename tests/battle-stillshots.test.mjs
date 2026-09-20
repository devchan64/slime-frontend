import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: stillshotBuildOutputs } = await build({ entryPoints: ['src/ui/battleStillshots.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { StillshotEventTracker, appendStillshotQueue, readStillshotSetting, findStillshotPresentation, STILLSHOT_ACTION_PRESENTATIONS } = await import(`data:text/javascript;base64,${Buffer.from(stillshotBuildOutputs[0].text).toString('base64')}`);
function createStillshotEvent(actionSequenceValue, actionTypeValue = 'ATTACK') {
  return { battleId: 'battle-one', actionId: `battle-one:${actionSequenceValue}`, sequence: actionSequenceValue, actionType: actionTypeValue };
}
function createBattleSnapshot(battleVersionValue, incomingStillshotEvents = []) {
  return { me: { id: 'player-one', lastResult: null }, battle: { id: 'battle-one', version: battleVersionValue, log: incomingStillshotEvents.map(stillshotEventRecord => ({ stillshot: stillshotEventRecord })) } };
}
test('첫 스냅샷은 재생하지 않고 확정된 일반 공격만 중복 없이 순서대로 표시한다', () => {
  const stillshotEventTracker = new StillshotEventTracker();
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(createBattleSnapshot(3, [createStillshotEvent(3)])), []);
  const nextBattleSnapshot = createBattleSnapshot(5, [createStillshotEvent(3), createStillshotEvent(4), createStillshotEvent(5)]);
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(nextBattleSnapshot).map(stillshotEventRecord => stillshotEventRecord.sequence), [4, 5]);
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(nextBattleSnapshot), []);
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(createBattleSnapshot(3)), []);
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(nextBattleSnapshot), []);
});
test('전투 종료 스냅샷에서 마지막 공격을 회수하고 재접속·다른 캐릭터에서는 재생하지 않는다', () => {
  const stillshotEventTracker = new StillshotEventTracker();
  stillshotEventTracker.collectNewStillshots(createBattleSnapshot(5));
  const finalBattleSnapshot = { me: { id: 'player-one', lastResult: { stillshots: [createStillshotEvent(4), createStillshotEvent(6)] } }, battle: null };
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(finalBattleSnapshot), [createStillshotEvent(6)]);
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(finalBattleSnapshot), []);
  assert.deepEqual(new StillshotEventTracker().collectNewStillshots(finalBattleSnapshot), []);
  assert.deepEqual(stillshotEventTracker.collectNewStillshots({ ...finalBattleSnapshot, me: { ...finalBattleSnapshot.me, id: 'player-two' } }), []);
});
test('대기열은 현재 연출과 최신 행동을 유지하며 최대 4개로 제한한다', () => {
  assert.deepEqual(appendStillshotQueue([createStillshotEvent(1)], [2,3,4,5,6].map(actionSequenceValue => createStillshotEvent(actionSequenceValue))).map(stillshotEventRecord => stillshotEventRecord.sequence), [1,4,5,6]);
});
test('스틸샷 기본값은 켜짐이며 저장된 끄기와 잘못된 설정을 구분한다', () => {
  assert.equal(readStillshotSetting({ getItem: () => null }), true);
  assert.equal(readStillshotSetting({ getItem: () => 'false' }), false);
  assert.equal(readStillshotSetting({ getItem: () => 'true' }), true);
  assert.throws(() => readStillshotSetting({ getItem: () => 'invalid' }), /설정/);
});

test('스킬 스틸샷은 진행 전투와 종료 결과 모두에서 표시하지 않는다', () => {
  const stillshotEventTracker = new StillshotEventTracker();
  stillshotEventTracker.collectNewStillshots(createBattleSnapshot(1));
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(createBattleSnapshot(3, [createStillshotEvent(2, 'SKILL'), createStillshotEvent(3)])), [createStillshotEvent(3)]);
  const finalBattleSnapshot = { me: { id: 'player-one', lastResult: { stillshots: [createStillshotEvent(4, 'SKILL'), createStillshotEvent(5)] } }, battle: null };
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(finalBattleSnapshot), [createStillshotEvent(5)]);
});

test('명령별 표시 정의는 현재 일반 공격만 활성화한다', () => {
  assert.deepEqual(findStillshotPresentation('ATTACK'), { translationMessageKey: 'stillshots.attack', displayDurationMilliseconds: 900 });
  for (const unregisteredActionType of ['SKILL', 'MOVE', 'GUARD', 'END_TURN', '__proto__']) {
    assert.equal(findStillshotPresentation(unregisteredActionType), undefined);
  }
});

test('새 명령 등록 시 공통 이벤트 추적과 표시 정의를 재사용한다', () => {
  STILLSHOT_ACTION_PRESENTATIONS.MOVE = { translationMessageKey: 'test.move', displayDurationMilliseconds: 600 };
  try {
    const stillshotEventTracker = new StillshotEventTracker();
    stillshotEventTracker.collectNewStillshots(createBattleSnapshot(1));
    assert.deepEqual(stillshotEventTracker.collectNewStillshots(createBattleSnapshot(2, [createStillshotEvent(2, 'MOVE')])), [createStillshotEvent(2, 'MOVE')]);
    assert.equal(findStillshotPresentation('MOVE').displayDurationMilliseconds, 600);
  } finally { delete STILLSHOT_ACTION_PRESENTATIONS.MOVE; }
});
