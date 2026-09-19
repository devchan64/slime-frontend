import { canStep } from "../game/terrain/elevation";
import type { Position, State } from "../client/types";

const DIRECTIONS = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;
const key = (p: Position) => `${p.column},${p.row}`;
export const sameCell = (a: Position, b: Position) => a.column === b.column && a.row === b.row;
export const fieldDistance = (a: Position, b: Position) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);

export function fieldRoute(start: Position, end: Position, map: State["map"]): Position[] | null {
  const valid = (p: Position) => Number.isInteger(p.column) && Number.isInteger(p.row) && p.column >= 0 && p.row >= 0 && p.column < map.columns && p.row < map.rows;
  const blocked = new Set(map.blocked.map(key));
  if (!valid(start) || !valid(end) || blocked.has(key(end))) return null;
  const queue = [start];
  const parents = new Map<string, Position | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (sameCell(current, end)) {
      const path: Position[] = [];
      let p = current;
      while (!sameCell(p, start)) {
        path.push(p);
        p = parents.get(key(p))!;
      }
      return path.reverse();
    }
    for (const [dc, dr] of DIRECTIONS) {
      const p = { column: current.column + dc, row: current.row + dr };
      if (valid(p) && !blocked.has(key(p)) && !parents.has(key(p)) && canStep(current,p,map)) {
        parents.set(key(p), current);
        queue.push(p);
      }
    }
  }
  return null;
}

// 몬스터가 있는 칸을 통과하지 않고 조우 가능한 인접 칸까지 접근한다.
export function encounterRoute(start: Position, target: Position, map: State["map"]): Position[] | null {
  if (fieldDistance(start, target) <= 1) return [];
  const approachMap = {...map, blocked: [...map.blocked, target]};
  const routes = DIRECTIONS.map(([dc,dr]) => fieldRoute(start, {column:target.column+dc,row:target.row+dr}, approachMap))
    .filter((route): route is Position[] => route !== null);
  routes.sort((a,b) => a.length-b.length);
  return routes[0] ?? null;
}
