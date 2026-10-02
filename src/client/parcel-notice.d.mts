export const PARCEL_NOTICE_REFRESH_MS: number;
export function validateParcelArrivalNotice(currentNoticeRecord: unknown, currentCharacterIdentifier: string): number;
export function watchParcelArrivalNotice(currentRequestNotice: () => Promise<unknown>, currentCharacterIdentifier: string,
  currentReceiveCount: (currentPendingCount: number) => void, currentReceiveError: (currentRequestError: unknown) => void,
  currentTimerHost?: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>): () => void;
