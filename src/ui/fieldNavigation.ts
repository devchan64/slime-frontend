import { canStep } from "../game/terrain/elevation";
import type { Position, State } from "../client/types";

const DIRECTIONS = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;
const key = (p: Position) => `${p.column},${p.row}`;
export const sameCell = (a: Position, b: Position) => a.column === b.column && a.row === b.row;
export const fieldDistance = (a: Position, b: Position) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);

export function fieldRoute(start: Position, end: Position, map: State["map"]): Position[] | null {
  return routeToAny(start,[end],map);
}

function routeToAny(start: Position, ends: Position[], map: State['map']): Position[] | null {
  const valid = (p: Position) => Number.isInteger(p.column) && Number.isInteger(p.row) && p.column >= 0 && p.row >= 0 && p.column < map.columns && p.row < map.rows;
  const blocked = new Set(map.blocked.map(key));
  if (!valid(start)) return null;
  const targets=ends.filter(p=>valid(p)&&!blocked.has(key(p)));
  if(!targets.length)return null;
  const priority=new Map(targets.map((p,index)=>[key(p),index]));
  const queue = [start];
  const parents = new Map<string, Position | null>([[key(start), null]]);
  for (let i = 0; i < queue.length;) {
    const levelEnd=queue.length;
    // 같은 거리에서는 기존 목적 후보 순서(위·왼쪽·오른쪽·아래)를 유지한다.
    let destination: Position | null=null, best=Infinity;
    for(let candidate=i;candidate<levelEnd;candidate++) {
      const rank=priority.get(key(queue[candidate]));
      if(rank!==undefined&&rank<best){destination=queue[candidate];best=rank;}
    }
    if (destination) {
      const path: Position[] = [];
      let p = destination;
      while (!sameCell(p, start)) {
        path.push(p);
        p = parents.get(key(p))!;
      }
      return path.reverse();
    }
    for(;i<levelEnd;i++) {
     const current=queue[i];
     for (const [dc, dr] of DIRECTIONS) {
      const p = { column: current.column + dc, row: current.row + dr };
      if (valid(p) && !blocked.has(key(p)) && !parents.has(key(p)) && canStep(current,p,map)) {
        parents.set(key(p), current);
        queue.push(p);
      }
     }
    }
  }
  return null;
}

// 몬스터가 있는 칸을 통과하지 않고 조우 가능한 인접 칸까지 접근한다.
export function encounterRoute(start: Position, target: Position, map: State["map"]): Position[] | null {
  if (fieldDistance(start, target) <= 1) return [];
  const approachMap = {...map, blocked: [...map.blocked, target]};
  return routeToAny(start,DIRECTIONS.map(([dc,dr])=>({column:target.column+dc,row:target.row+dr})),approachMap);
}
