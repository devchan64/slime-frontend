/** 전투·필드는 한 칸 4프레임, 세 칸 12프레임을 실효 12 FPS로 재생한다. */
const CHARACTER_WALK_FRAME_COUNT = 12;
import {BOARD_ANIMATION_FRAME_RATE} from '../animation/boardAnimation';
export const CHARACTER_MOVEMENT_SPEED_MULTIPLIER = 2;
export const TILE_MOVEMENT_DURATION_MS = CHARACTER_WALK_FRAME_COUNT * 1000 / (BOARD_ANIMATION_FRAME_RATE * CHARACTER_MOVEMENT_SPEED_MULTIPLIER);
const FIELD_MOVEMENT_BATCH_TILES = 3;
export const FIELD_TILE_MOVEMENT_DURATION_MS = TILE_MOVEMENT_DURATION_MS / FIELD_MOVEMENT_BATCH_TILES;
export const BATTLE_TILE_MOVEMENT_DURATION_MS = TILE_MOVEMENT_DURATION_MS / FIELD_MOVEMENT_BATCH_TILES;
const FIELD_MOVEMENT_SETTLE_MILLISECONDS = 90 / CHARACTER_MOVEMENT_SPEED_MULTIPLIER;
const FIELD_STEP_REQUEST_MILLISECONDS = 300 / CHARACTER_MOVEMENT_SPEED_MULTIPLIER;
/** 세 칸까지 먼저 확정하되 각 칸은 서버에서 독립 판정한다. */
export function calculateFieldMovementPause(currentCompletedSteps: number, currentHasNextStep: boolean): number {
  if (currentCompletedSteps % FIELD_MOVEMENT_BATCH_TILES === 0)
    return TILE_MOVEMENT_DURATION_MS + FIELD_MOVEMENT_SETTLE_MILLISECONDS - FIELD_STEP_REQUEST_MILLISECONDS * (FIELD_MOVEMENT_BATCH_TILES - 1);
  const currentBatchStepCount = currentCompletedSteps % FIELD_MOVEMENT_BATCH_TILES;
  return currentHasNextStep ? FIELD_STEP_REQUEST_MILLISECONDS
    : currentBatchStepCount * FIELD_TILE_MOVEMENT_DURATION_MS + FIELD_MOVEMENT_SETTLE_MILLISECONDS
      - (currentBatchStepCount - 1) * FIELD_STEP_REQUEST_MILLISECONDS;
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

/** 정지 시간은 제외하고 세 칸 걷기 루프의 완료 지점부터 다시 시작한다. */
export function calculateResumedAnimationStart(currentRenderTime: number, previousTrackStart: number,
  previousAnimationStart: number, previousSegmentCount: number): number {
  const completedWalkingDuration = previousTrackStart - previousAnimationStart
    + previousSegmentCount * FIELD_TILE_MOVEMENT_DURATION_MS;
  const completedWalkingPhase = completedWalkingDuration % TILE_MOVEMENT_DURATION_MS;
  return currentRenderTime - (Math.abs(completedWalkingPhase - TILE_MOVEMENT_DURATION_MS) < 1e-7 ? 0 : completedWalkingPhase);
}
