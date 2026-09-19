import type {MapRotation} from '../terrain/rotation';
import type {Direction} from './cellAnimation';

export type WorldFacing = 'column_positive' | 'column_negative' | 'row_positive' | 'row_negative';
const VECTORS: Record<WorldFacing, readonly [number,number]> = {
  column_positive: [1,0], column_negative: [-1,0], row_positive: [0,1], row_negative: [0,-1],
};
const SCREEN: Record<WorldFacing,Direction> = {
  column_positive: 'down_right', column_negative: 'up_left', row_positive: 'down_left', row_negative: 'up_right',
};

/** 저장된 논리 방향은 바꾸지 않고 현재 맵 회전에 따른 시트 방향을 선택한다. */
export function screenFacing(facing: WorldFacing, rotation: MapRotation): Direction {
  if (typeof facing !== 'string' || !Object.hasOwn(VECTORS,facing)) throw new Error('지원하지 않는 전투 논리 방향입니다.');
  if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) throw new Error('지원하지 않는 맵 회전입니다.');
  const [column,row] = VECTORS[facing];
  const [c,r] = rotation === 0 ? [column,row] : rotation === 1 ? [-row,column]
    : rotation === 2 ? [-column,-row] : [row,-column];
  return SCREEN[c > 0 ? 'column_positive' : c < 0 ? 'column_negative' : r > 0 ? 'row_positive' : 'row_negative'];
}
