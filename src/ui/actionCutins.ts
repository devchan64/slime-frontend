import type { State } from '../client/types';

export type ActionCutinEvent = {
  actionId: string; battleId: string; sequence: number; unitId: string; actorName: string;
  actionType: string; skillId: string | null;
  appearance: { kind: 'character'; groups: { costume: string; hair: string; face: string } }
    | { kind: 'monster'; group: string };
};
export type ActionCutinPresentation = { translationMessageKey: string; displayDurationMilliseconds: number };
// 명령 확장 시 표시 정의만 등록하며 공통 대기열·외형·컴포넌트를 재사용한다.
export const ACTION_CUTIN_ACTION_PRESENTATIONS: Readonly<Record<string, ActionCutinPresentation>> = {
  ATTACK: { translationMessageKey: 'cutins.attack', displayDurationMilliseconds: 900 },
};
export function findActionCutinPresentation(actionTypeValue: string): ActionCutinPresentation | undefined {
  return Object.hasOwn(ACTION_CUTIN_ACTION_PRESENTATIONS, actionTypeValue) ? ACTION_CUTIN_ACTION_PRESENTATIONS[actionTypeValue] : undefined;
}
export const ACTION_CUTIN_QUEUE_LIMIT = 4;
// 기존 브라우저 설정을 유지하기 위해 저장 키는 v1 명칭을 사용한다.
export const ACTION_CUTIN_SETTING_KEY = 'slime.game.stillshots.v1';

export function readActionCutinSetting(settingStorageReader: Pick<Storage, 'getItem'>): boolean {
  const storedSettingValue = settingStorageReader.getItem(ACTION_CUTIN_SETTING_KEY);
  if (storedSettingValue === null) return true;
  if (storedSettingValue !== 'true' && storedSettingValue !== 'false') throw new Error('액션 컷인 설정 값이 올바르지 않습니다.');
  return storedSettingValue === 'true';
}

// 최초 접속·재접속 스냅샷은 기준점이며 지난 연출을 다시 재생하지 않는다.
export class ActionCutinTracker {
  private trackedPlayerIdentity = '';
  private trackedBattleIdentity = '';
  private highestBattleSequence = 0;
  collectNewActionCutins(incomingStateRecord: State): ActionCutinEvent[] {
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
    const incomingActionCutinEvents = incomingBattleRecord
      ? incomingBattleRecord.log.flatMap(actionLogRecord => actionLogRecord.stillshot ? [actionLogRecord.stillshot] : [])
      : incomingStateRecord.me.lastResult?.stillshots ?? [];
    const freshActionCutinEvents = incomingActionCutinEvents.filter(actionCutinEventRecord =>
      findActionCutinPresentation(actionCutinEventRecord.actionType) !== undefined
      && actionCutinEventRecord.battleId === this.trackedBattleIdentity
      && actionCutinEventRecord.sequence > this.highestBattleSequence);
    this.highestBattleSequence = Math.max(this.highestBattleSequence, incomingBattleRecord?.version ?? 0,
      ...freshActionCutinEvents.map(actionCutinEventRecord => actionCutinEventRecord.sequence));
    return freshActionCutinEvents;
  }
}

export function appendActionCutinQueue(currentActionCutinQueue: ActionCutinEvent[], incomingActionCutinEvents: ActionCutinEvent[]) {
  // 폭주 시 현재 연출을 유지하고 가장 최근 행동을 남겨 조작 지연을 제한한다.
  const combinedActionCutinQueue = [...currentActionCutinQueue, ...incomingActionCutinEvents];
  return combinedActionCutinQueue.length <= ACTION_CUTIN_QUEUE_LIMIT ? combinedActionCutinQueue
    : [combinedActionCutinQueue[0], ...combinedActionCutinQueue.slice(-(ACTION_CUTIN_QUEUE_LIMIT - 1))];
}
