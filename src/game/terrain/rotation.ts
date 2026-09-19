import type { Position } from '../../client/types';
import { surfaceElevationTiles, type Surface } from './elevation';

export type MapRotation = 0 | 1 | 2 | 3;
export const nextRotation = (rotation: MapRotation, direction: -1 | 1): MapRotation =>
  ((rotation + direction + 4) % 4) as MapRotation;

// 논리 좌표는 유지하고 렌더링 좌표만 90도 단위로 바꾼다.
export function toView(p: Position, map: Surface, rotation: MapRotation): Position {
  switch (rotation) {
    case 0: return { ...p };
    case 1: return { column: map.rows - 1 - p.row, row: p.column };
    case 2: return { column: map.columns - 1 - p.column, row: map.rows - 1 - p.row };
    case 3: return { column: p.row, row: map.columns - 1 - p.column };
  }
}
export function fromView(p: Position, map: Surface, rotation: MapRotation): Position {
  const dimensions = rotation % 2 ? { columns: map.rows, rows: map.columns } : map;
  return toView(p, dimensions, ((4 - rotation) % 4) as MapRotation);
}
export function rotatedSurface(map: Surface, rotation: MapRotation): Surface {
  const columns = rotation % 2 ? map.rows : map.columns;
  const rows = rotation % 2 ? map.columns : map.rows;
  const elevations = map.elevations ? Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const source = fromView({ column, row }, map, rotation);
      return map.elevations![source.row][source.column];
    })) : undefined;
  return { columns, rows, elevations, elevationTiles: surfaceElevationTiles(map).map(tile=>({...tile,cell:toView(tile.cell,map,rotation),lower:toView(tile.lower,map,rotation)})), ramps: map.ramps?.map(ramp => ({ ...ramp,
    start: toView(ramp.start, map, rotation), end: toView(ramp.end, map, rotation),
  })) };
}
export function rotateConnections(mask: number, rotation: MapRotation): number {
  return ((mask << rotation) | (mask >> (4 - rotation))) & 15;
}
