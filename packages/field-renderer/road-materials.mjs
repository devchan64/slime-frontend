/** 재질과 무관하게 도로 셀을 판별한다. */
export const FIELD_ROAD_TERRAINS = Object.freeze(['road','dirt-road','stone-road']);
export function isFieldRoadTerrain(currentTerrainName){return FIELD_ROAD_TERRAINS.includes(currentTerrainName);}
