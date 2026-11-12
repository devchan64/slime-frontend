import type {MapRotation} from '../terrain/rotation';
import type {Direction} from './cellAnimation';

export type WorldFacing = 'column_positive' | 'column_negative' | 'row_positive' | 'row_negative';
export const BOARD_ACTOR_SCREEN_DIRECTION = 'down_left' as const;
export const CHARACTER_SCREEN_DIRECTION = 'down_right' as const;
const SUPPORTED_WORLD_FACINGS: readonly WorldFacing[] = ['column_positive', 'column_negative', 'row_positive', 'row_negative'];

/** 논리 방향과 맵 회전을 검증하고 개체의 기본 시트 방향을 반환한다. */
export function screenFacing(actorWorldFacing: WorldFacing, currentMapRotation: MapRotation, actorBaseDirection: "down_left" | "down_right" = BOARD_ACTOR_SCREEN_DIRECTION): Direction {
  if (!SUPPORTED_WORLD_FACINGS.includes(actorWorldFacing)) throw new Error('지원하지 않는 전투 논리 방향입니다.');
  if (!Number.isInteger(currentMapRotation) || currentMapRotation < 0 || currentMapRotation > 3) throw new Error('지원하지 않는 맵 회전입니다.');
  if (actorBaseDirection !== "down_left" && actorBaseDirection !== "down_right") throw new Error("지원하지 않는 기본 방향입니다.");
  return actorBaseDirection;
}

/** 원본 방향을 기준으로 화면의 이동 방향에 맞춰 반전한다. */
export function shouldMirrorActorSprite(actorWorldFacing: WorldFacing, currentMapRotation: MapRotation, spriteBaseDirection: "down_left" | "down_right" = "down_left"): boolean {
  screenFacing(actorWorldFacing, currentMapRotation);
  const clockwiseWorldDirections: readonly WorldFacing[] = ['column_positive', 'row_positive', 'column_negative', 'row_negative'];
  const rotatedDirectionIndex = (clockwiseWorldDirections.indexOf(actorWorldFacing) + currentMapRotation) % clockwiseWorldDirections.length;
  const leftFacingMirror = rotatedDirectionIndex === 0 || rotatedDirectionIndex === 3;
  return spriteBaseDirection === "down_right" ? !leftFacingMirror : leftFacingMirror;
}

/** 월드 방향이 없으면 캐릭터는 오른쪽을 기본으로 표시한다. */
export function resolveActorSpriteMirror(actorWorldFacing: WorldFacing | undefined, currentMapRotation: MapRotation, spriteBaseDirection: "down_left" | "down_right", characterActorFlag: boolean): boolean {
  if (actorWorldFacing !== undefined) return shouldMirrorActorSprite(actorWorldFacing, currentMapRotation, spriteBaseDirection);
  return characterActorFlag && spriteBaseDirection === "down_left";
}
