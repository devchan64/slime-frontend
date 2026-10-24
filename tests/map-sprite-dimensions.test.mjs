import assert from 'node:assert/strict';
import test from 'node:test';
import { MAXIMUM_MAP_SPRITE_SOURCE_SIZE, TREE_BILLBOARD_SOURCE_SIZE, VEGETATION_BILLBOARD_SOURCE_SIZE, validateMapSpriteDimensions } from '../scripts/map-sprite-dimensions.mjs';

test('맵 빌보드와 건물 원본은 512px 이하만 허용한다', () => {
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/buildings/town-house-v1.png' }, { width: MAXIMUM_MAP_SPRITE_SOURCE_SIZE, height: 410 }));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/buildings/town-house-v1.png' }, { width: MAXIMUM_MAP_SPRITE_SOURCE_SIZE + 1, height: 410 }), /512px/);
});

test('나무와 식생 빌보드는 크롭된 비정사각 원본을 크기 상한 내에서 허용한다', () => {
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/billboards/orchard-tree-v1.png' }, { width: TREE_BILLBOARD_SOURCE_SIZE, height: TREE_BILLBOARD_SOURCE_SIZE }, 'tree'));
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/billboards/orchard-tree-v1.png' }, { width: 110, height: 240 }, 'tree'));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/billboards/orchard-tree-v1.png' }, { width: 257, height: 240 }, 'tree'), /나무 빌보드/);
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/billboards/fern-v1.png' }, { width: 80, height: 90 }, 'vegetation'));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/billboards/fern-v1.png' }, { width: 0, height: 90 }, 'vegetation'), /크기 계약 오류/);
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/billboards/fern-v1.png' }, { width: VEGETATION_BILLBOARD_SOURCE_SIZE, height: VEGETATION_BILLBOARD_SOURCE_SIZE }, 'vegetation'));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/billboards/fern-v1.png' }, { width: TREE_BILLBOARD_SOURCE_SIZE, height: TREE_BILLBOARD_SOURCE_SIZE }, 'vegetation'), /식생 빌보드/);
});

test('애니메이션 시트는 개별 프레임 제한과 영역을 검증한다', () => {
  const currentAssetRecord = { path: 'assets/billboards/waypoint-guide-v3.png' };
  const currentSheetDimensions = { width: 768, height: 512 };
  const currentAnimationMetadata = { sheet: currentSheetDimensions, frames: [{ rect: { x: 512, y: 256, width: 256, height: 256 } }] };
  assert.doesNotThrow(() => validateMapSpriteDimensions(currentAssetRecord, currentSheetDimensions, undefined, currentAnimationMetadata));
  assert.throws(() => validateMapSpriteDimensions(currentAssetRecord, { width: 1536, height: 1024 }, undefined), /512px/);
  assert.throws(() => validateMapSpriteDimensions(currentAssetRecord, { width: 512, height: 341 }, undefined, currentAnimationMetadata), /시트 크기 불일치/);
  currentAnimationMetadata.frames[0].rect.width = 257;
  assert.throws(() => validateMapSpriteDimensions(currentAssetRecord, currentSheetDimensions, undefined, currentAnimationMetadata), /프레임 영역 오류/);
});
