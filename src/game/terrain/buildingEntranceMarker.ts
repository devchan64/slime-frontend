type BuildingScreenBounds = {left:number;top:number;width:number;height:number};
type BuildingScreenPoint = {x:number;y:number};

/** 문턱 이미지 좌표가 아닌 실제 출입구 타일 중앙에 마커를 둔다. */
export function resolveBuildingEntranceMarker(_currentTextureIdentifier:string,_currentImageBounds:BuildingScreenBounds,currentTilePoint:BuildingScreenPoint):BuildingScreenPoint {
  return currentTilePoint;
}
