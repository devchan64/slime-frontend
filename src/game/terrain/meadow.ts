import {canStep, type Surface} from "./elevation";
export type Position = { column: number; row: number };
export type Waypoint = Position & {
  id: string; target: string; name?: string;
  targetName?: string;
  direction?: "west" | "east" | "north" | "south";
  targetWaypointId?: string;
};
export type TerrainMap = Surface & {
  columns: number;
  rows: number;
  startPoint: Position;
  blocked: Position[];
  connections: Waypoint[];
  terrainRows?: string[];
  terrainCodes?: Record<string,string>;
};

export const TILE_W = 64;
export const TILE_H = 32;
export const TEXTURE_SIZE = 128;
export const TERRAIN_KINDS = ["grass", "dew", "road", "flowers"] as const;
export type TerrainKind = (typeof TERRAIN_KINDS)[number];
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const JUNCTION_FRACTION = 0.5;
const FLOWER_PATCH_SCALE = 4;
const DEW_PATCH_SCALE = 5;
const hash = (x: number, y: number, seed: number) => {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const patchNoise = (column: number, row: number, scale: number, seed: number) => {
  const x = column / scale, y = row / scale;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u) * (1 - v) +
    (hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u) * v;
};
export const cellKey = (p: Position) => `${p.column},${p.row}`;

// 서버의 통행 제한을 유지하며 시작점·출구·초원 안쪽을 연결한다.
export function buildMeadowRoad(map: TerrainMap): Set<string> {
  if(map.terrainRows){
    const serverRoadCells=new Set<string>();
    map.terrainRows.forEach((terrainRowString,terrainRowIndex)=>[...terrainRowString].forEach((terrainCodeValue,terrainColumnIndex)=>{
      if(map.terrainCodes?.[terrainCodeValue]==='road')serverRoadCells.add(`${terrainColumnIndex},${terrainRowIndex}`);
    }));
    return serverRoadCells;
  }
  const blocked = new Set(map.blocked.map(cellKey));
  // 도로 밑그림은 결계탑 아래까지 연결한다. 실제 통행은 서버 blocked를 따른다.
  blocked.delete(cellKey(map.startPoint));
  const valid = (p: Position) => p.column >= 0 && p.row >= 0 &&
    p.column < map.columns && p.row < map.rows && !blocked.has(cellKey(p));
  if (!valid(map.startPoint)) throw new Error("초원 시작점이 통행 가능한 셀이 아닙니다.");
  const road = new Set<string>([cellKey(map.startPoint)]);
  const connect = (start: Position, end: Position) => {
    if (!valid(end)) throw new Error(`도로 목적지가 통행 불가입니다: ${cellKey(end)}`);
    const queue = [start];
    const parents = new Map<string, Position | null>([[cellKey(start), null]]);
    const costs = new Map<string, number>([[cellKey(start), 0]]);
    const distance = (p: Position) => Math.abs(p.column - end.column) + Math.abs(p.row - end.row);
    const deviation = (p: Position) => Math.abs((p.column - start.column) * (end.row - start.row) -
      (p.row - start.row) * (end.column - start.column));
    while (queue.length) {
      // 같은 길이의 경로 중 직선에 가까운 셀을 우선해 큰 직각 꺾임을 줄인다.
      queue.sort((a, b) => (costs.get(cellKey(a))! + distance(a)) -
        (costs.get(cellKey(b))! + distance(b)) || deviation(a) - deviation(b));
      const p = queue.shift()!;
      if (cellKey(p) === cellKey(end)) break;
      for (const [dc, dr] of DIRECTIONS) {
        const next = { column: p.column + dc, row: p.row + dr };
        const cost = costs.get(cellKey(p))! + 1;
        if (valid(next) && canStep(p,next,map) && (!costs.has(cellKey(next)) || cost < costs.get(cellKey(next))!)) {
          parents.set(cellKey(next), p);
          costs.set(cellKey(next), cost);
          queue.push(next);
        }
      }
    }
    if (!parents.has(cellKey(end))) throw new Error(`도로를 연결할 수 없습니다: ${cellKey(end)}`);
    for (let p: Position | null = end; p; p = parents.get(cellKey(p))!) road.add(cellKey(p));
  };
  const junction = {
    column: Math.floor(map.columns * JUNCTION_FRACTION),
    row: Math.floor(map.rows * JUNCTION_FRACTION),
  };
  if (!valid(junction)) throw new Error("초원 도로 분기점이 통행 불가입니다.");
  connect(junction, map.startPoint);
  const distance = (p: Position) => Math.abs(p.column - map.startPoint.column) + Math.abs(p.row - map.startPoint.row);
  const gates = [...map.connections].sort((a, b) => distance(a) - distance(b));
  gates.forEach((gate, index) => connect(index === 0 ? map.startPoint : junction, gate));
  return road;
}

export function meadowTile(column: number, row: number, road: Set<string>): TerrainKind {
  if (road.has(`${column},${row}`)) return "road";
  if (patchNoise(column, row, FLOWER_PATCH_SCALE, 91) > 0.67) return "flowers";
  return patchNoise(column, row, DEW_PATCH_SCALE, 317) > 0.55 ? "dew" : "grass";
}

export function fieldTerrainAt(fieldMapDefinition:TerrainMap,terrainColumnIndex:number,terrainRowIndex:number,fieldRoadCells:Set<string>):TerrainKind | "paving" | "water" {
  if(!fieldMapDefinition.terrainRows)return meadowTile(terrainColumnIndex,terrainRowIndex,fieldRoadCells);
  const terrainCodeValue=fieldMapDefinition.terrainRows[terrainRowIndex]?.[terrainColumnIndex];
  const terrainKindValue=fieldMapDefinition.terrainCodes?.[terrainCodeValue];
  if(terrainKindValue === "paving" || terrainKindValue === "water")return terrainKindValue;
  if(!TERRAIN_KINDS.includes(terrainKindValue as TerrainKind))throw new Error('필드 표시 타일이 누락되었거나 지원하지 않는 종류입니다.');
  return terrainKindValue as TerrainKind;
}
