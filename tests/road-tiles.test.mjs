import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: ['src/game/terrain/roadTiles.ts'], bundle: true,
  write: false, format: 'esm', platform: 'node' });
const { roadConnections, waterConnections } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const center = { column: 1, row: 1 };
const surface = { columns: 3, rows: 3 };

test('고립·끝·직선·모서리·분기·교차의 16개 연결을 구분한다', () => {
  const neighbors = ['1,0', '2,1', '1,2', '0,1'];
  for (let mask = 0; mask < 16; mask++) {
    const road = new Set(['1,1', ...neighbors.filter((_, index) => mask & (1 << index))]);
    assert.equal(roadConnections(center, surface, road), mask);
  }
});

test('절벽으로 끊긴 도로는 연결하지 않고 명시된 계단만 연결한다', () => {
  const map = { ...surface, elevations: [[0,0,1],[0,0,1],[0,0,1]] };
  const road = new Set(['1,1','2,1']);
  assert.equal(roadConnections(center, map, road), 0);
  map.ramps = [{ start: center, end: { column: 2, row: 1 } }];
  assert.equal(roadConnections(center, map, road), 2);
  assert.equal(roadConnections({ column: 2, row: 1 }, map, road), 8);
});

test('맵 밖이나 도로가 아닌 셀로 잘못 연결하지 않는다', () => {
  assert.equal(roadConnections({ column: 0, row: 0 }, surface, new Set(['0,0','-1,0','0,-1'])), 0);
  assert.throws(() => roadConnections(center, surface, new Set()), /도로가 아닌 셀/);
});

test('수면은 같은 높이에서 이어지고 계단이 있어도 단차를 넘지 않는다', () => {
  const water = new Set(['1,1', '2,1']);
  assert.equal(waterConnections(center, surface, water), 2);
  const map = { ...surface, elevations: [[0,0,1],[0,0,1],[0,0,1]],
    ramps: [{ start: center, end: { column: 2, row: 1 } }] };
  assert.equal(waterConnections(center, map, water), 0);
});
