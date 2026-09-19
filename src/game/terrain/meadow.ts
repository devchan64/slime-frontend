export type Position = { column: number; row: number };
export type Waypoint = Position & { id: string; target: string; name?: string };
export type TerrainMap = {
  columns: number;
  rows: number;
  startPoint: Position;
  blocked: Position[];
  connections: Waypoint[];
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
  const blocked = new Set(map.blocked.map(cellKey));
  const valid = (p: Position) => p.column >= 0 && p.row >= 0 &&
    p.column < map.columns && p.row < map.rows && !blocked.has(cellKey(p));
  if (!valid(map.startPoint)) throw new Error("초원 시작점이 통행 가능한 셀이 아닙니다.");
  const road = new Set<string>([cellKey(map.startPoint)]);
  const connect = (start: Position, end: Position) => {
    if (!valid(end)) throw new Error(`도로 목적지가 통행 불가입니다: ${cellKey(end)}`);
    const queue = [start];
    const parents = new Map<string, Position | null>([[cellKey(start), null]]);
    for (let i = 0; i < queue.length && !parents.has(cellKey(end)); i++) {
      const p = queue[i];
      for (const [dc, dr] of DIRECTIONS) {
        const next = { column: p.column + dc, row: p.row + dr };
        if (valid(next) && !parents.has(cellKey(next))) {
          parents.set(cellKey(next), p);
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
