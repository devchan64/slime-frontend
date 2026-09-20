import { parseActionCutinEvent } from './actionCutinContract';
import type { State } from '../client/types';

export type ActionCutinEvent = {
  actionId: string; battleId: string; sequence: number; unitId: string; actorName: string;
  actionType: string; skillId: string | null;
  appearance: { kind: 'character'; groups: { costume: string; hair: string; face: string } }
    | { kind: 'monster'; group: string };
};
export type ActionCutinPresentation = { translationMessageKey: string };
// 명령 확장 시 표시 정의만 등록하며 공통 대기열·외형·컴포넌트를 재사용한다.
export const ACTION_CUTIN_ACTION_PRESENTATIONS: Readonly<Record<string, ActionCutinPresentation>> = {
  ATTACK: { translationMessageKey: 'cutins.attack' },
};
export function findActionCutinPresentation(actionTypeValue: string): ActionCutinPresentation | undefined {
  return Object.hasOwn(ACTION_CUTIN_ACTION_PRESENTATIONS, actionTypeValue) ? ACTION_CUTIN_ACTION_PRESENTATIONS[actionTypeValue] : undefined;
}
export const ACTION_CUTIN_QUEUE_LIMIT = 4;
export const ACTION_CUTIN_SETTING_KEY = 'slime.game.action-cutins.v2';
export const ACTION_CUTIN_LEGACY_KEY = 'slime.game.stillshots.v1';
export const ACTION_CUTIN_DURATION_OPTIONS = [1, 2, 3, 0] as const;
export type ActionCutinDuration = typeof ACTION_CUTIN_DURATION_OPTIONS[number];
export const ACTION_CUTIN_DEFAULT_SECONDS: ActionCutinDuration = 3;

export function parseActionCutinDuration(storedSettingValue: string): ActionCutinDuration {
  if (!['0', '1', '2', '3'].includes(storedSettingValue)) throw new Error('액션 컷인 설정 값이 올바르지 않습니다.');
  return Number(storedSettingValue) as ActionCutinDuration;
}

export function readActionCutinSetting(settingStorageReader: Pick<Storage, 'getItem'>): ActionCutinDuration {
  const storedSettingValue = settingStorageReader.getItem(ACTION_CUTIN_SETTING_KEY);
  if (storedSettingValue !== null) return parseActionCutinDuration(storedSettingValue);
  const legacySettingValue = settingStorageReader.getItem(ACTION_CUTIN_LEGACY_KEY);
  if (legacySettingValue === 'false') return 0;
  if (legacySettingValue === null || legacySettingValue === 'true') return ACTION_CUTIN_DEFAULT_SECONDS;
  throw new Error('액션 컷인 설정 값이 올바르지 않습니다.');
}

// 최초 접속·재접속 스냅샷은 기준점이며 지난 연출을 다시 재생하지 않는다.
export class ActionCutinTracker {
  private trackedPlayerIdentity = '';
  private trackedBattleIdentity = '';
  private highestBattleSequence = 0;
  private trackedBattleFinished = false;
  collectNewActionCutins(incomingStateRecord: State): ActionCutinEvent[] {
    if (this.trackedPlayerIdentity !== incomingStateRecord.me.id) {
      this.trackedPlayerIdentity = incomingStateRecord.me.id;
      this.trackedBattleIdentity = '';
      this.highestBattleSequence = 0;
      this.trackedBattleFinished = false;
    }
    const incomingBattleRecord = incomingStateRecord.battle;
    if (incomingBattleRecord && incomingBattleRecord.id !== this.trackedBattleIdentity) {
      this.trackedBattleIdentity = incomingBattleRecord.id;
      this.highestBattleSequence = incomingBattleRecord.version;
      this.trackedBattleFinished = false;
      return [];
    }
    if (this.trackedBattleFinished) return [];
    const incomingBattleResult = incomingStateRecord.me.lastResult;
    if (!incomingBattleRecord && incomingBattleResult?.battleId !== this.trackedBattleIdentity) return [];
    const incomingActionCutinEvents = incomingBattleRecord
      ? incomingBattleRecord.log.flatMap(actionLogRecord => actionLogRecord.stillshot ? [actionLogRecord.stillshot] : [])
      : incomingStateRecord.me.lastResult?.stillshots ?? [];
    if (!Array.isArray(incomingActionCutinEvents)) throw new Error('액션 컷인 목록 형식이 올바르지 않습니다.');
    const validatedActionCutinEvents = incomingActionCutinEvents.map(parseActionCutinEvent);
    const freshActionCutinEvents = [...new Map(validatedActionCutinEvents.filter(actionCutinEventRecord =>
      findActionCutinPresentation(actionCutinEventRecord.actionType) !== undefined
      && actionCutinEventRecord.battleId === this.trackedBattleIdentity
      && actionCutinEventRecord.sequence > this.highestBattleSequence)
      .map(actionCutinEventRecord => [actionCutinEventRecord.actionId, actionCutinEventRecord])).values()]
      .sort((earlierActionEvent, laterActionEvent) => earlierActionEvent.sequence - laterActionEvent.sequence);
    this.highestBattleSequence = Math.max(this.highestBattleSequence, incomingBattleRecord?.version ?? 0,
      ...freshActionCutinEvents.map(actionCutinEventRecord => actionCutinEventRecord.sequence));
    // 최초 종료 결과까지의 연출만 허용한다. 결과창 이후 지연된 컷은 다시 열지 않는다.
    if (!incomingBattleRecord) this.trackedBattleFinished = true;
    return freshActionCutinEvents;
  }
}

export function appendActionCutinQueue(currentActionCutinQueue: ActionCutinEvent[], incomingActionCutinEvents: ActionCutinEvent[]) {
  // 폭주 시 현재 연출을 유지하고 가장 최근 행동을 남겨 조작 지연을 제한한다.
  const combinedActionCutinQueue = [...currentActionCutinQueue, ...incomingActionCutinEvents];
  return combinedActionCutinQueue.length <= ACTION_CUTIN_QUEUE_LIMIT ? combinedActionCutinQueue
    : [combinedActionCutinQueue[0], ...combinedActionCutinQueue.slice(-(ACTION_CUTIN_QUEUE_LIMIT - 1))];
}
