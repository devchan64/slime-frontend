/** 게임 월드 좌표의 기준값. 원본 이미지 픽셀·논리 셀·화면 고정 UI와 구분한다. */
export const MAP_DEFAULT_ZOOM = 1;
export const MAP_TILE_WIDTH = 80;
export const MAP_TILE_HEIGHT = 40;
/** 등록된 지형 원본 해상도. 화면 타일 크기와 독립적으로 검증한다. */
export const GAME_TILE_SOURCE_SIZES = Object.freeze([256, 512]);

export const CHARACTER_BODY_HEIGHT = 80;
export const MAP_ELEVATION_HEIGHT = 32;
export const MAP_BASE_THICKNESS = 16;
// 이전 1.3 카메라 배율을 월드 단위로 이전한 비율. 줌 조작의 화면 변화량도 보존한다.
export const WORLD_UNIT_MIGRATION = 1.3;

export const TOWN_TILE_WIDTH = 160;
export const TOWN_TILE_HEIGHT = 80;
const FIELD_TILE_DIMENSIONS = Object.freeze({width: MAP_TILE_WIDTH, height: MAP_TILE_HEIGHT});
const TOWN_TILE_DIMENSIONS = Object.freeze({width: TOWN_TILE_WIDTH, height: TOWN_TILE_HEIGHT});
/** 맵 종류를 지형 단위로 유지하여 회전·전투 전환 시 크기가 섞이지 않게 한다. */
export function resolveMapTileSize(currentMapSurface: {safeTown?: boolean}) {
  return currentMapSurface.safeTown ? TOWN_TILE_DIMENSIONS : FIELD_TILE_DIMENSIONS;
}

export function validateTerrainSourceDimensions(currentSourceKey: string, currentSourceWidth: number, currentSourceHeight: number) {
  if (currentSourceWidth !== currentSourceHeight || !GAME_TILE_SOURCE_SIZES.includes(currentSourceWidth)) {
    throw new Error(`타일 원본 크기 오류: ${currentSourceKey}는 256×256px 또는 512×512px여야 합니다. 실제 ${currentSourceWidth}×${currentSourceHeight}px.`);
  }
}
