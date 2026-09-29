/** 타일 이동은 시작을 빠르게 하고 도착 시 감속한다. */
export function calculateTileMovementProgress(linearMovementProgress: number): number {
  const clampedMovementProgress = Math.max(0, Math.min(1, linearMovementProgress));
  return 1 - (1 - clampedMovementProgress) ** 2;
}
