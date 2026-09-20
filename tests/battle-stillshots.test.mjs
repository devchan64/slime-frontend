import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles: stillshotBuildOutputs } = await build({ entryPoints: ['src/ui/battleStillshots.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { StillshotEventTracker, appendStillshotQueue, readStillshotSetting } = await import(`data:text/javascript;base64,${Buffer.from(stillshotBuildOutputs[0].text).toString('base64')}`);
function createStillshotEvent(actionSequenceValue, actionTypeValue = 'ATTACK') {
  return { battleId: 'battle-one', actionId: `battle-one:${actionSequenceValue}`, sequence: actionSequenceValue, actionType: actionTypeValue };
}
function createBattleSnapshot(battleVersionValue, incomingStillshotEvents = []) {
  return { me: { id: 'player-one', lastResult: null }, battle: { id: 'battle-one', version: battleVersionValue, log: incomingStillshotEvents.map(stillshotEventRecord => ({ stillshot: stillshotEventRecord })) } };
}
test('첫 스냅샷은 재생하지 않고 확정된 공격·스킬만 중복 없이 순서대로 표시한다', () => {
  const stillshotEventTracker = new StillshotEventTracker();
  assert.deepEqual(stillshotEventTracker.collectNewStillshots(createBattleSnapshot(3, [createStillshotEvent(3)])), []);
  const nextBattleSnapshot = createBattleSnapshot(5, [createStillshotEvent(3), createStillshotEvent(4), createStillshotEvent(5, 'SKILL')]);
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
