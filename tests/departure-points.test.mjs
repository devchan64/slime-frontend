import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/ui/departurePoints.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { unallocatedPoints } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('미배분 CP와 SP를 각각 확인하며 이전 API에 SP 잔액을 만들지 않는다', () => {
  assert.equal(unallocatedPoints({ cp: 10 }), '10 CP');
  assert.equal(unallocatedPoints({ cp: 0, sp: 5 }), '5 SP');
  assert.equal(unallocatedPoints({ cp: 10, sp: 5 }), '10 CP · 5 SP');
  assert.equal(unallocatedPoints({ cp: 0, sp: 0 }), '');
  assert.equal(unallocatedPoints({ cp: 0 }), '');
  assert.throws(() => unallocatedPoints({ cp: -1 }));
  assert.throws(() => unallocatedPoints({ cp: 0, sp: NaN }));
});
