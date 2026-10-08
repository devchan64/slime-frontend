import {MAP_TILE_WIDTH,MAP_TILE_HEIGHT,GAME_TILE_SOURCE_SIZES,TOWN_TILE_WIDTH,TOWN_TILE_HEIGHT} from '../../../packages/field-renderer/render-constants.mjs';
export {MAP_DEFAULT_ZOOM,MAP_TILE_WIDTH,MAP_TILE_HEIGHT,GAME_TILE_SOURCE_SIZES,CHARACTER_BODY_HEIGHT,MAP_ELEVATION_HEIGHT,MAP_BASE_THICKNESS,WORLD_UNIT_MIGRATION,TOWN_TILE_WIDTH,TOWN_TILE_HEIGHT} from '../../../packages/field-renderer/render-constants.mjs';
/** 게임 월드 좌표의 기준값. 원본 이미지 픽셀·논리 셀·화면 고정 UI와 구분한다. */
/** 등록된 지형 원본 해상도. 화면 타일 크기와 독립적으로 검증한다. */

// 이전 1.3 카메라 배율을 월드 단위로 이전한 비율. 줌 조작의 화면 변화량도 보존한다.

const FIELD_TILE_DIMENSIONS = Object.freeze({width: MAP_TILE_WIDTH, height: MAP_TILE_HEIGHT});
const TOWN_TILE_DIMENSIONS = Object.freeze({width: TOWN_TILE_WIDTH, height: TOWN_TILE_HEIGHT});
/** 맵 종류를 지형 단위로 유지하여 회전·전투 전환 시 크기가 섞이지 않게 한다. */
export function resolveMapTileSize(currentMapSurface: {safeTown?: boolean}) {
  return currentMapSurface.safeTown ? TOWN_TILE_DIMENSIONS : FIELD_TILE_DIMENSIONS;
}

export function validateTerrainSourceDimensions(currentSourceKey: string, currentSourceWidth: number, currentSourceHeight: number) {
  if (currentSourceWidth !== currentSourceHeight || !GAME_TILE_SOURCE_SIZES.includes(currentSourceWidth)) {
    throw new Error(`타일 원본 크기 오류: ${currentSourceKey}는 64×64px, 128×128px, 256×256px 또는 512×512px여야 합니다. 실제 ${currentSourceWidth}×${currentSourceHeight}px.`);
  }
}
