import assert from 'node:assert/strict';
import test from 'node:test';
import { MAXIMUM_MAP_SPRITE_SOURCE_SIZE, TREE_BILLBOARD_SOURCE_SIZE, VEGETATION_BILLBOARD_SOURCE_SIZE, validateMapSpriteDimensions } from '../scripts/map-sprite-dimensions.mjs';

test('맵 빌보드와 건물 원본은 512px 이하만 허용한다', () => {
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/sprites/structures/town-house-v1.png' }, { width: MAXIMUM_MAP_SPRITE_SOURCE_SIZE, height: 410 }));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/sprites/structures/town-house-v1.png' }, { width: MAXIMUM_MAP_SPRITE_SOURCE_SIZE + 1, height: 410 }), /512px/);
});

test('나무와 식생 빌보드는 각각 고정 원본 크기를 사용한다', () => {
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/billboards/orchard-tree-v1.png' }, { width: TREE_BILLBOARD_SOURCE_SIZE, height: TREE_BILLBOARD_SOURCE_SIZE }, 'tree'));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/billboards/orchard-tree-v1.png' }, { width: VEGETATION_BILLBOARD_SOURCE_SIZE, height: VEGETATION_BILLBOARD_SOURCE_SIZE }, 'tree'), /나무 빌보드/);
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/billboards/fern-v1.png' }, { width: VEGETATION_BILLBOARD_SOURCE_SIZE, height: VEGETATION_BILLBOARD_SOURCE_SIZE }, 'vegetation'));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/billboards/fern-v1.png' }, { width: TREE_BILLBOARD_SOURCE_SIZE, height: TREE_BILLBOARD_SOURCE_SIZE }, 'vegetation'), /식생 빌보드/);
});
