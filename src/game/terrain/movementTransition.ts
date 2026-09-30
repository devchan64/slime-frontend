/** 한 칸의 이동·탄성 복귀을 식별할 수 있는 공통 이동 시간이다. */
export const TILE_MOVEMENT_DURATION_MS = 360;
/** 다음 서버 이동 요청은 한 칸 전환과 도착 여유 시간 뒤에 보낸다. */
export const FIELD_MOVEMENT_INTERVAL_MS = TILE_MOVEMENT_DURATION_MS + 90;

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
