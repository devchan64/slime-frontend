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
