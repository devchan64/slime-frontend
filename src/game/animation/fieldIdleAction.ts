/** 필드의 로컬 연출 전용 타이머. 서버 휴식·이동 상태를 변경하지 않는다. */
export const FIELD_IDLE_DELAY_MS = 15_000;
export class FieldIdleAction {
  private nextActionStartTime = 0;
  private currentActionStartTime: number | null = null;
  resetIdleAction(currentClockTime: number) {
    this.currentActionStartTime = null;
    this.nextActionStartTime = currentClockTime + FIELD_IDLE_DELAY_MS;
  }
  sampleIdleAction(currentClockTime: number, actionDurationMilliseconds: number, actionAllowedFlag: boolean): number | null {
    if (!Number.isFinite(actionDurationMilliseconds) || actionDurationMilliseconds <= 0) throw new Error('대기 동작 재생 시간이 올바르지 않습니다.');
    if (!actionAllowedFlag) { this.resetIdleAction(currentClockTime); return null; }
    if (this.currentActionStartTime !== null && currentClockTime - this.currentActionStartTime >= actionDurationMilliseconds) {
      // 프레임이 지연되어도 복귀 시점부터 온전히 15초를 기다린다.
      this.resetIdleAction(currentClockTime);
      return null;
    }
    if (this.currentActionStartTime === null && currentClockTime >= this.nextActionStartTime) this.currentActionStartTime = currentClockTime;
    return this.currentActionStartTime === null ? null : currentClockTime - this.currentActionStartTime;
  }
}
