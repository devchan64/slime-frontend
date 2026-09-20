import type { State } from '../client/types';

export type BattleStillshotEvent = {
  actionId: string; battleId: string; sequence: number; unitId: string; actorName: string;
  actionType: string; skillId: string | null;
  appearance: { kind: 'character'; groups: { costume: string; hair: string; face: string } }
    | { kind: 'monster'; group: string };
};
export type StillshotActionPresentation = { translationMessageKey: string; displayDurationMilliseconds: number };
// 명령 확장 시 표시 정의만 등록하며 공통 대기열·외형·컴포넌트를 재사용한다.
export const STILLSHOT_ACTION_PRESENTATIONS: Readonly<Record<string, StillshotActionPresentation>> = {
  ATTACK: { translationMessageKey: 'stillshots.attack', displayDurationMilliseconds: 900 },
};
export function findStillshotPresentation(actionTypeValue: string): StillshotActionPresentation | undefined {
  return Object.hasOwn(STILLSHOT_ACTION_PRESENTATIONS, actionTypeValue) ? STILLSHOT_ACTION_PRESENTATIONS[actionTypeValue] : undefined;
}
export const STILLSHOT_QUEUE_LIMIT = 4;
export const STILLSHOT_SETTING_KEY = 'slime.game.stillshots.v1';

export function readStillshotSetting(settingStorageReader: Pick<Storage, 'getItem'>): boolean {
  const storedSettingValue = settingStorageReader.getItem(STILLSHOT_SETTING_KEY);
  if (storedSettingValue === null) return true;
  if (storedSettingValue !== 'true' && storedSettingValue !== 'false') throw new Error('스틸샷 설정 값이 올바르지 않습니다.');
  return storedSettingValue === 'true';
}

// 최초 접속·재접속 스냅샷은 기준점이며 지난 연출을 다시 재생하지 않는다.
export class StillshotEventTracker {
  private trackedPlayerIdentity = '';
  private trackedBattleIdentity = '';
  private highestBattleSequence = 0;
  collectNewStillshots(incomingStateRecord: State): BattleStillshotEvent[] {
    if (this.trackedPlayerIdentity !== incomingStateRecord.me.id) {
      this.trackedPlayerIdentity = incomingStateRecord.me.id;
      this.trackedBattleIdentity = '';
      this.highestBattleSequence = 0;
    }
    const incomingBattleRecord = incomingStateRecord.battle;
    if (incomingBattleRecord && incomingBattleRecord.id !== this.trackedBattleIdentity) {
      this.trackedBattleIdentity = incomingBattleRecord.id;
      this.highestBattleSequence = incomingBattleRecord.version;
      return [];
    }
    const incomingStillshotEvents = incomingBattleRecord
      ? incomingBattleRecord.log.flatMap(actionLogRecord => actionLogRecord.stillshot ? [actionLogRecord.stillshot] : [])
      : incomingStateRecord.me.lastResult?.stillshots ?? [];
    const freshStillshotEvents = incomingStillshotEvents.filter(stillshotEventRecord =>
      findStillshotPresentation(stillshotEventRecord.actionType) !== undefined
      && stillshotEventRecord.battleId === this.trackedBattleIdentity
      && stillshotEventRecord.sequence > this.highestBattleSequence);
    this.highestBattleSequence = Math.max(this.highestBattleSequence, incomingBattleRecord?.version ?? 0,
      ...freshStillshotEvents.map(stillshotEventRecord => stillshotEventRecord.sequence));
    return freshStillshotEvents;
  }
}

export function appendStillshotQueue(currentStillshotQueue: BattleStillshotEvent[], incomingStillshotEvents: BattleStillshotEvent[]) {
  // 폭주 시 현재 연출을 유지하고 가장 최근 행동을 남겨 조작 지연을 제한한다.
  const combinedStillshotQueue = [...currentStillshotQueue, ...incomingStillshotEvents];
  return combinedStillshotQueue.length <= STILLSHOT_QUEUE_LIMIT ? combinedStillshotQueue
    : [combinedStillshotQueue[0], ...combinedStillshotQueue.slice(-(STILLSHOT_QUEUE_LIMIT - 1))];
}
