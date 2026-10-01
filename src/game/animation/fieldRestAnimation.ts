/** 화면 재생성에 독립적인 휴식 진입·해제 시간. 서버 휴식 상태는 변경하지 않는다. */
export type RestPlaybackSample = { actionNameValue: 'rest-entry' | 'rest-exit'; elapsedTimeValue: number };
type RestPlaybackRecord = { restingActiveFlag: boolean; transitionStartTime: number };
export class FieldRestAnimation {
  private actorPlaybackRecords = new Map<string, RestPlaybackRecord>();

  resetRestAnimations() { this.actorPlaybackRecords.clear(); }

  syncRestAnimations(actorRestStates: { actorStableIdentifier: string; restingActiveFlag: boolean }[], currentTimeValue: number) {
    const currentActorIdentifiers = new Set(actorRestStates.map(actorRestState => actorRestState.actorStableIdentifier));
    for (const actorStableIdentifier of this.actorPlaybackRecords.keys()) {
      if (!currentActorIdentifiers.has(actorStableIdentifier)) this.actorPlaybackRecords.delete(actorStableIdentifier);
    }
    for (const actorRestState of actorRestStates) {
      const previousRestRecord = this.actorPlaybackRecords.get(actorRestState.actorStableIdentifier);
      if (!previousRestRecord || previousRestRecord.restingActiveFlag !== actorRestState.restingActiveFlag) {
        this.actorPlaybackRecords.set(actorRestState.actorStableIdentifier, {
          restingActiveFlag: actorRestState.restingActiveFlag,
          transitionStartTime: previousRestRecord || actorRestState.restingActiveFlag ? currentTimeValue : -Infinity,
        });
      }
    }
  }

  sampleRestAnimation(actorStableIdentifier: string, currentTimeValue: number, exitDurationValue: number): RestPlaybackSample | null {
    const actorPlaybackRecord = this.actorPlaybackRecords.get(actorStableIdentifier);
    if (!actorPlaybackRecord) return null;
    const elapsedTimeValue = Math.max(0, currentTimeValue - actorPlaybackRecord.transitionStartTime);
    if (actorPlaybackRecord.restingActiveFlag) return { actionNameValue: 'rest-entry', elapsedTimeValue };
    return elapsedTimeValue < exitDurationValue ? { actionNameValue: 'rest-exit', elapsedTimeValue } : null;
  }
}
