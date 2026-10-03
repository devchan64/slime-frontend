/** 전투는 기존 한 칸 12프레임, 필드는 한 칸 6프레임을 8 FPS로 재생한다. */
const CHARACTER_WALK_FRAME_COUNT = 12;
const CHARACTER_WALK_FRAME_RATE = 8;
export const TILE_MOVEMENT_DURATION_MS = CHARACTER_WALK_FRAME_COUNT * 1000 / CHARACTER_WALK_FRAME_RATE;
export const FIELD_TILE_MOVEMENT_DURATION_MS = TILE_MOVEMENT_DURATION_MS / 2;
const FIELD_MOVEMENT_SETTLE_MILLISECONDS = 90;
const FIELD_PAIRED_REQUEST_MILLISECONDS = 300;
const FIELD_MOVEMENT_BATCH_TILES = 2;
/** 두 칸까지 먼저 확정하되 각 칸은 서버에서 독립 판정한다. */
export function calculateFieldMovementPause(currentCompletedSteps: number, currentHasNextStep: boolean): number {
  if (currentCompletedSteps % FIELD_MOVEMENT_BATCH_TILES === 0)
    return TILE_MOVEMENT_DURATION_MS + FIELD_MOVEMENT_SETTLE_MILLISECONDS - FIELD_PAIRED_REQUEST_MILLISECONDS;
  return currentHasNextStep ? FIELD_PAIRED_REQUEST_MILLISECONDS
    : FIELD_TILE_MOVEMENT_DURATION_MS + FIELD_MOVEMENT_SETTLE_MILLISECONDS;
}

/** 최대 약 3.7%만 목표를 넘는 약한 ease-out-back 탄성이다. */
const TILE_MOVEMENT_OVERSHOOT_STRENGTH = 1;

/** 목표를 살짝 지난 뒤 복귀하며 종료 시 논리 셀에 정확히 맞춘다. */
export function calculateTileMovementProgress(linearMovementProgress: number): number {
  const clampedMovementProgress = Math.max(0, Math.min(1, linearMovementProgress));
  if (clampedMovementProgress === 0 || clampedMovementProgress === 1) return clampedMovementProgress;
  const shiftedMovementProgress = clampedMovementProgress - 1;
  return 1 + (TILE_MOVEMENT_OVERSHOOT_STRENGTH + 1) * shiftedMovementProgress ** 3
    + TILE_MOVEMENT_OVERSHOOT_STRENGTH * shiftedMovementProgress ** 2;
}
