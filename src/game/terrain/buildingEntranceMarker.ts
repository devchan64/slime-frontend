/** 건물 원본의 이미지 크기에 대한 출입문 바닥 위치. */
const BUILDING_ENTRANCE_IMAGE_POINTS: Record<string, {x:number;y:number}> = {
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
