import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints:['src/ui/growthCost.ts'], bundle:true, write:false, format:'esm', platform:'node' });
const { growthCost } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('능력치와 스킬을 바꾸어 올려도 통합 비용을 표시한다', () => {
  assert.equal(growthCost({body:1,intellect:1}, {literacy:1}).cost, 1);
  assert.equal(growthCost({body:2,intellect:1}, {literacy:1}).cost, 2);
  assert.equal(growthCost({body:2,intellect:1}, {literacy:2}).cost, 4);
  assert.equal(growthCost({body:2,intellect:2}, {literacy:2, mathematics:1}).cost, 8);
});
test('잘못된 레벨을 거부하고 거대 비용은 지수로 표시한다', () => {
  assert.throws(() => growthCost({body:0}, {}));
  assert.throws(() => growthCost({}, {literacy:NaN}));
  assert.equal(growthCost({body:1025}, {}).label, '2^1024');
});
test('신규 스킬의 0 → 1 성장과 이전 지급 레벨의 비용을 구분한다', () => {
  assert.equal(growthCost({body:1}, {physical_activity:0}, {physical_activity:0}).cost, 1);
  assert.equal(growthCost({body:1}, {physical_activity:1}, {physical_activity:0}).cost, 2);
  assert.equal(growthCost({body:1}, {physical_activity:1}).cost, 1);
  assert.throws(() => growthCost({body:1}, {physical_activity:-1}, {physical_activity:0}));
});
