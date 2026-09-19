import type { Position, State } from '../../client/types';
import { inBounds } from './elevation';

/** 표시 이름·잔고·턴 변경은 고정 지형을 다시 만들지 않는다. */
export function terrainRenderSignature(state: State, rotation: number): string {
  const field=state.battle?.field, map=field ?? state.map;
  return JSON.stringify([rotation, map.columns, map.rows, map.elevations, map.ramps, map.elevationTiles,
    field?.cells, state.battle?.blocked ?? state.map.blocked, field?.environment?.themeId ?? state.map.id,
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
