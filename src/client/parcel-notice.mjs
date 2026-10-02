// 도착 알림은 첨부물 조회·수령 권한을 부여하지 않는다.
export const PARCEL_NOTICE_REFRESH_MS = 15000;
export function validateParcelArrivalNotice(currentNoticeRecord, currentCharacterIdentifier) {
  if (!currentNoticeRecord || currentNoticeRecord.characterId !== currentCharacterIdentifier ||
      !Number.isSafeInteger(currentNoticeRecord.pendingCount) || currentNoticeRecord.pendingCount < 0 ||
      !Number.isFinite(currentNoticeRecord.serverTime) || currentNoticeRecord.serverTime < 0)
    throw new Error('소포 도착 알림 응답이 올바르지 않습니다.');
  return currentNoticeRecord.pendingCount;
}
export function watchParcelArrivalNotice(currentRequestNotice, currentCharacterIdentifier, currentReceiveCount,
    currentReceiveError, currentTimerHost = globalThis) {
  let currentWatcherStopped = false;
  let currentRefreshTimer;
  async function refreshParcelArrivalNotice() {
    try {
      const currentPendingCount = validateParcelArrivalNotice(await currentRequestNotice(), currentCharacterIdentifier);
      if (!currentWatcherStopped) currentReceiveCount(currentPendingCount);
    } catch (currentRequestError) {
      if (!currentWatcherStopped) currentReceiveError(currentRequestError);
    } finally {
      if (!currentWatcherStopped) currentRefreshTimer = currentTimerHost.setTimeout(refreshParcelArrivalNotice, PARCEL_NOTICE_REFRESH_MS);
    }
  }
  void refreshParcelArrivalNotice();
  return () => { currentWatcherStopped = true; currentTimerHost.clearTimeout(currentRefreshTimer); };
}
