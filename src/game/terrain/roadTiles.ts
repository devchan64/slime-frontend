import { canStep, heightAt, type Surface } from "./elevation";
import type { Position } from "../../client/types";

// 탑뷰 기준 북·동·남·서. 투영 전 텍스처와 논리 셀의 방향을 일치시킨다.
export const ROAD_CONNECTIONS = [
  { dc: 0, dr: -1, bit: 1 },
  { dc: 1, dr: 0, bit: 2 },
  { dc: 0, dr: 1, bit: 4 },
  { dc: -1, dr: 0, bit: 8 },
] as const;
export const ROAD_TILE_COUNT = 16;
export const roadFrame = (mask: number) => `road-${mask}`;

// 물은 같은 높이의 수면끼리만 연결한다. 계단을 따라 물을 이어 붙이지 않는다.
export function waterConnections(cell: Position, map: Surface, water: Set<string>): number {
  let mask = 0;
  for (const { dc, dr, bit } of ROAD_CONNECTIONS) {
    const next = { column: cell.column + dc, row: cell.row + dr };
    if (water.has(`${next.column},${next.row}`) && canStep(cell, next, map) &&
      heightAt(cell, map) === heightAt(next, map)) mask |= bit;
  }
  return mask;
}

export function roadConnections(cell: Position, map: Surface, road: Set<string>): number {
  if (!road.has(`${cell.column},${cell.row}`)) throw new Error("도로가 아닌 셀의 연결을 요청했습니다.");
  let mask = 0;
  for (const { dc, dr, bit } of ROAD_CONNECTIONS) {
    const next = { column: cell.column + dc, row: cell.row + dr };
    if (road.has(`${next.column},${next.row}`) && canStep(cell, next, map)) mask |= bit;
  }
  return mask;
}

// 야외 도로는 지역별 한 재질의 전체 타일을 사용한다. 좌표별 임의 혼합을 하지 않는다.
const FIELD_ROAD_FRAME_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["dirt-road", ["meadow", "grove", "wind-hills", "mist-lake", "ash-edge", "cinder-path", "clover-bank", "dry-creek", "fallen-canopy", "lantern-wood", "moss-clearing", "old-orchard", "reed-crossing", "root-trail", "silver-marsh", "windrow-road", "granary-flats"]],
  ["stone-road", ["boar-ridge", "broken-quarry", "crystal-cut", "dawn-overlook", "mill-ridge"]],
  ["road", ["pebble-shore", "brine-bank", "salt-causeway", "salt-flat"]],
];
export function selectFieldRoadFrame(connectionMaskValue:number,_currentCellPosition:Position,currentMapIsTown:boolean,currentMapIdentifier:string=""):string {
  if (currentMapIsTown) return roadFrame(connectionMaskValue);
  const selectedRoadFrameGroup = FIELD_ROAD_FRAME_GROUPS.find(([, currentMapIdentifiers]) => currentMapIdentifiers.includes(currentMapIdentifier));
  if (!selectedRoadFrameGroup) throw new Error(`야외 도로 재질이 등록되지 않았습니다: ${currentMapIdentifier}`);
  return selectedRoadFrameGroup[0];
}
