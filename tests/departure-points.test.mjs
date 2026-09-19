import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/ui/departurePoints.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { unallocatedPoints } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const state = (balances, attributes = { body: 2, intellect: 1, spirit: 1 }, skills = { physical_activity: 1 }) =>
  ({ attributes, skills, ...balances }); // 다음 성장 비용 2

test('잔고가 남아도 다음 비용보다 부족하면 CP·SP 배분을 안내하지 않는다', () => {
  assert.equal(unallocatedPoints(state({ cp: 1, sp: 1 })), '');
  assert.equal(unallocatedPoints(state({ cp: 0, sp: 0 })), '');
  assert.equal(unallocatedPoints(state({ cp: 1 })), '');
});
test('비용과 같은 잔고부터 안내하며 배분 가능한 자원만 표시한다', () => {
  assert.equal(unallocatedPoints(state({ cp: 2, sp: 1 })), '2 CP');
  assert.equal(unallocatedPoints(state({ cp: 1, sp: 2 })), '2 SP');
  assert.equal(unallocatedPoints(state({ cp: 2, sp: 5 })), '2 CP · 5 SP');
  assert.equal(unallocatedPoints(state({ cp: 1 }, { body: 1 })), '1 CP');
});
test('성장 후 오른 비용과 보유 대상 유무를 반영한다', () => {
  assert.equal(unallocatedPoints(state({ cp: 3, sp: 3 }, { body: 2 }, { literacy: 2 })), '');
  assert.equal(unallocatedPoints(state({ cp: 0, sp: 10 }, { body: 1 }, {})), '');
  assert.equal(unallocatedPoints(state({ cp: 10, sp: 0 }, {}, { literacy: 1 })), '');
  assert.equal(unallocatedPoints(state({ cp: 10, sp: 10 }, { body: 1025 })), '');
});
test('이전 API에 SP 잔고를 만들지 않고 잘못된 잔고를 거절한다', () => {
  assert.equal(unallocatedPoints(state({ cp: 2 })), '2 CP');
  assert.throws(() => unallocatedPoints(state({ cp: -1 })));
  assert.throws(() => unallocatedPoints(state({ cp: 0, sp: NaN })));
});
