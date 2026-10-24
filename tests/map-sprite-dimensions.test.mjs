import assert from 'node:assert/strict';
import test from 'node:test';
import { MAXIMUM_MAP_SPRITE_SOURCE_SIZE, validateMapSpriteDimensions } from '../scripts/map-sprite-dimensions.mjs';

test('맵 빌보드와 건물 원본은 512px 이하만 허용한다', () => {
  assert.doesNotThrow(() => validateMapSpriteDimensions({ path: 'assets/buildings/town-house-v1.png' }, { width: MAXIMUM_MAP_SPRITE_SOURCE_SIZE, height: 410 }));
  assert.throws(() => validateMapSpriteDimensions({ path: 'assets/buildings/town-house-v1.png' }, { width: MAXIMUM_MAP_SPRITE_SOURCE_SIZE + 1, height: 410 }), /512px/);
});

test('나무와 자연물은 분류와 무관하게 공통 512px 상한을 사용한다', () => {
  for (const currentCategoryName of ['tree', 'vegetation', 'large-trees']) {
    const currentAssetRecord = { path: 'assets/billboards/tree-v1.png' };
    for (const currentSourceDimensions of [{ width: 80, height: 90 }, { width: 256, height: 256 }, { width: 457, height: 512 }]) {
      assert.doesNotThrow(() => validateMapSpriteDimensions(currentAssetRecord, currentSourceDimensions, currentCategoryName));
    }
    assert.throws(() => validateMapSpriteDimensions(currentAssetRecord, { width: 0, height: 90 }, currentCategoryName), /크기 계약 오류/);
    assert.throws(() => validateMapSpriteDimensions(currentAssetRecord, { width: 513, height: 512 }, currentCategoryName), /512px/);
  }
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
