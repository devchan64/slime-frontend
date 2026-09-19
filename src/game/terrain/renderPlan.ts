import type { Position, State } from '../../client/types';
import { elevationRange } from './viewport';
import { inBounds, type Surface } from './elevation';
import { rotatedSurface, type MapRotation } from './rotation';

/** 표시 이름·잔고·턴 변경은 고정 지형을 다시 만들지 않는다. */
export function terrainRenderSignature(state: State, rotation: number): string {
  const field=state.battle?.field, map=field ?? state.map;
  return JSON.stringify([rotation, map.columns, map.rows, map.elevations, map.ramps, map.elevationTiles,
    field?.cells, state.map.terrainRows, state.map.terrainCodes, state.battle?.blocked ?? state.map.blocked, field?.environment?.themeId ?? state.map.id,
    field ? null : [state.map.startPoint,state.map.safeRadius,
      state.map.connections.map(({column,row})=>({column,row}))]]);
}

/** 동적 표시는 안전구간·선택·서버 전술 범위에 필요한 셀만 생성한다. */
export function overlayCells(state: State, textured: boolean, selected: Position | null,
                             groups: Iterable<string>[]): Position[] {
  const map=state.battle?.field ?? state.map;
  const cells=new Map<string,Position>();
  const add=(p:Position)=>{if(inBounds(p,map))cells.set(`${p.column},${p.row}`,p);};
  if (!textured) {
    for(let row=0;row<map.rows;row++)for(let column=0;column<map.columns;column++)add({column,row});
  } else if (!state.battle) {
    const {startPoint,safeRadius}=state.map;
    for(let dr=-safeRadius;dr<=safeRadius;dr++)for(let dc=-(safeRadius-Math.abs(dr));dc<=safeRadius-Math.abs(dr);dc++)
      add({column:startPoint.column+dc,row:startPoint.row+dr});
  }
  for(const group of groups)for(const key of group){const [column,row]=key.split(',').map(Number);add({column,row});}
  if(selected)add(selected);
  return [...cells.values()];
}

export type TerrainPlan = {signature: string; rotation: MapRotation; source: Surface;
  surface: Surface; heights: {min:number;max:number}};

/** 이전 계획 하나만 보존해 상태 갱신마다 고도 행렬을 재할당하지 않는다. */
export function prepareTerrain(state: State, rotation: MapRotation, previous: TerrainPlan | null): TerrainPlan {
  const signature = terrainRenderSignature(state, 0);
  const unchanged = previous?.signature === signature;
  if (unchanged && previous.rotation === rotation) return previous;
  const map = state.battle?.field ?? state.map;
  const source = unchanged ? previous.source : {
    columns: map.columns, rows: map.rows,
    elevations: map.elevations?.map(row => row.slice()),
    ramps: structuredClone(map.ramps), elevationTiles: structuredClone(map.elevationTiles),
  };
  const surface=rotatedSurface(source, rotation);
  return {signature, rotation, source, surface,
    heights:unchanged ? previous.heights : elevationRange(source)};
}
