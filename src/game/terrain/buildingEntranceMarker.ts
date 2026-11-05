/** 건물 원본의 이미지 크기에 대한 출입문 바닥 위치. */
const BUILDING_ENTRANCE_IMAGE_POINTS: Record<string, {x:number;y:number}> = {
  'town-grainstead-guild-guide-v2': {x:0.375,y:0.675},
  'town-grainstead-bookshop-guide-v2': {x:0.375,y:0.67},
  'town-grainstead-inn-guide-v2': {x:0.642,y:0.675},
  'town-grainstead-market-guide-v2': {x:0.38,y:0.67},
  'town-grainstead-workshop-guide-v2': {x:0.65,y:0.68},
  'town-grainstead-guild-guide-v1': {x:0.283,y:0.833},
  'town-grainstead-bookshop-guide-v1': {x:0.267,y:0.861},
  'town-grainstead-inn-guide-v1': {x:0.687,y:0.858},
  'town-grainstead-market-guide-v1': {x:0.3,y:0.879},
  'town-grainstead-workshop-guide-v1': {x:0.638,y:0.893},
  'town-grainstead-guild-v3': {x:0.35,y:0.80},
  'town-grainstead-bookshop-v2': {x:0.36,y:0.86},
  'town-grainstead-inn-v2': {x:0.73,y:0.82},
  'town-grainstead-market-v2': {x:0.28,y:0.81},
  'town-grainstead-workshop-v3': {x:0.67,y:0.88},
  'town-reedhaven-guild-guide-v1': {x:0.32,y:0.74},
  'town-reedhaven-bookshop-guide-v1': {x:0.32,y:0.79},
  'town-reedhaven-inn-guide-v1': {x:0.70,y:0.79},
  'town-reedhaven-market-guide-v1': {x:0.34,y:0.71},
  'town-reedhaven-workshop-guide-v1': {x:0.635,y:0.81},
  'town-stonewarm-guild-guide-v1': {x:0.32,y:0.91},
  'town-stonewarm-bookshop-guide-v1': {x:0.29,y:0.84},
  'town-stonewarm-inn-guide-v1': {x:0.67,y:0.92},
  'town-stonewarm-market-guide-v1': {x:0.30,y:0.78},
  'town-stonewarm-workshop-guide-v1': {x:0.65,y:0.80},
  'town-stonewarm-guild-v5': {x:0.32,y:0.88},
  'town-stonewarm-bookshop-v5': {x:0.30,y:0.89},
  'town-stonewarm-inn-v5': {x:0.31,y:0.87},
  'town-stonewarm-market-v5': {x:0.27,y:0.88},
  'town-stonewarm-workshop-v5': {x:0.25,y:0.88},
};

type BuildingScreenBounds = {left:number;top:number;width:number;height:number};
type BuildingScreenPoint = {x:number;y:number};

/** 지정된 이미지 출입문을 화면 좌표로 변환한다. 다른 건물은 입구 타일을 사용한다. */
export function resolveBuildingEntranceMarker(currentTextureIdentifier:string,currentImageBounds:BuildingScreenBounds,currentTilePoint:BuildingScreenPoint):BuildingScreenPoint {
  const currentImagePoint = BUILDING_ENTRANCE_IMAGE_POINTS[currentTextureIdentifier];
  if (!currentImagePoint) return currentTilePoint;
  return {x:currentImageBounds.left+currentImageBounds.width*currentImagePoint.x,y:currentImageBounds.top+currentImageBounds.height*currentImagePoint.y};
}
