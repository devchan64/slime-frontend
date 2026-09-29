import type {MapRotation} from '../terrain/rotation';
import type {Direction} from './cellAnimation';

export type WorldFacing = 'column_positive' | 'column_negative' | 'row_positive' | 'row_negative';
export const BOARD_ACTOR_SCREEN_DIRECTION: Direction = 'down_left';
const SUPPORTED_WORLD_FACINGS: readonly WorldFacing[] = ['column_positive', 'column_negative', 'row_positive', 'row_negative'];

/** 논리 방향을 검증하되 맵 위 개체는 항상 정면왼쪽 클립을 사용한다. */
export function screenFacing(actorWorldFacing: WorldFacing, currentMapRotation: MapRotation): Direction {
  if (!SUPPORTED_WORLD_FACINGS.includes(actorWorldFacing)) throw new Error('지원하지 않는 전투 논리 방향입니다.');
  if (!Number.isInteger(currentMapRotation) || currentMapRotation < 0 || currentMapRotation > 3) throw new Error('지원하지 않는 맵 회전입니다.');
  return BOARD_ACTOR_SCREEN_DIRECTION;
}
