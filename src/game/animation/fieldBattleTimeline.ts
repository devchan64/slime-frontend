import type {MapChatBattleEvent, State} from '../../client/types';

export type FieldVanishSample = {event: MapChatBattleEvent; progress: number};

/** 서버 확정 이벤트만 표현한다. 목록에서 몹이 사라진 것으로 승패·소멸을 추측하지 않는다. */
export class FieldBattleTimeline {
  private currentChannelIdentity = '';
  private latestServerTimestamp = 0;
  private latestReceiptTimestamp = 0;
  private activeBattleEvents = new Map<string, MapChatBattleEvent>();

  synchronizeBattleEvents(currentGameState: Pick<State, 'channel' | 'generation' | 'serverTime' | 'mapChatBattleEvents'>,
                         currentReceiptTimestamp: number) {
    // 이전 v1 스냅샷은 이벤트·채널 표시 계약이 없다. 소멸을 추측하지 않는다.
    if (!currentGameState.channel) {
      if (currentGameState.mapChatBattleEvents?.length) throw new Error('맵챗 이벤트의 채널 정보가 없습니다.');
      this.clearBattleEvents();
      return;
    }
    const currentChannelIdentity = `${currentGameState.channel.id}:${currentGameState.generation}`;
    if (this.currentChannelIdentity !== currentChannelIdentity) {
      this.clearBattleEvents();
      this.currentChannelIdentity = currentChannelIdentity;
      this.latestServerTimestamp = currentGameState.serverTime;
    } else {
      this.latestServerTimestamp = Math.max(currentGameState.serverTime,
        this.latestServerTimestamp + (currentReceiptTimestamp - this.latestReceiptTimestamp) / 1000);
    }
    this.latestReceiptTimestamp = currentReceiptTimestamp;
    for (const currentEventRecord of currentGameState.mapChatBattleEvents ?? []) {
      if (currentEventRecord.schemaVersion !== 1 || !currentEventRecord.eventId ||
          !Number.isFinite(currentEventRecord.occurredAt) || !Number.isFinite(currentEventRecord.expiresAt) ||
          currentEventRecord.expiresAt <= currentEventRecord.occurredAt ||
          !Number.isInteger(currentEventRecord.position.column) || !Number.isInteger(currentEventRecord.position.row))
        throw new Error('맵챗 전투 이벤트 형식이 올바르지 않습니다.');
      if (currentEventRecord.channelId !== currentGameState.channel.id || currentEventRecord.phase !== 'ENDED' ||
          currentEventRecord.effect !== 'MONSTER_VANISH' || currentEventRecord.expiresAt <= this.latestServerTimestamp) continue;
      if (!this.activeBattleEvents.has(currentEventRecord.eventId))
        this.activeBattleEvents.set(currentEventRecord.eventId, structuredClone(currentEventRecord));
    }
    this.sampleBattleEffects(currentReceiptTimestamp);
  }

  sampleBattleEffects(currentRenderTimestamp: number): FieldVanishSample[] {
    const currentServerTimestamp = this.latestServerTimestamp + (currentRenderTimestamp - this.latestReceiptTimestamp) / 1000;
    const currentEffectSamples: FieldVanishSample[] = [];
    for (const [currentEventIdentifier, currentEventRecord] of this.activeBattleEvents) {
      if (currentServerTimestamp >= currentEventRecord.expiresAt) {
        this.activeBattleEvents.delete(currentEventIdentifier);
        continue;
      }
      if (currentServerTimestamp < currentEventRecord.occurredAt) continue;
      currentEffectSamples.push({event: currentEventRecord,
        progress: (currentServerTimestamp - currentEventRecord.occurredAt) / (currentEventRecord.expiresAt - currentEventRecord.occurredAt)});
    }
    return currentEffectSamples;
  }

  clearBattleEvents() {
    this.activeBattleEvents.clear();
    this.currentChannelIdentity = '';
    this.latestServerTimestamp = 0;
    this.latestReceiptTimestamp = 0;
  }
}
