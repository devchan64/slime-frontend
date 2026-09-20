export type BorrowedLoanEntry = {
  id: string; name: string; startedAt: number; expiresAt: number; expired: boolean; inBattle: boolean;
  hp: number; maxHp: number; attributes: Record<string, number>; skills: Record<string, number>;
};
export type BorrowedLoanPage = {serverTime: number; entries: BorrowedLoanEntry[]; nextCursor: string | null};
export const LOAN_CLOCK_INTERVAL_MS = 1000;
const LOAN_SECOND_MILLISECONDS = 1000;

export function calculateLoanRemainingSeconds(loanExpirySeconds: number, serverAnchorSeconds: number, elapsedClockMilliseconds: number) {
  return Math.max(0, loanExpirySeconds - serverAnchorSeconds - Math.max(0, elapsedClockMilliseconds) / LOAN_SECOND_MILLISECONDS);
}
function validateLoanLevelMap(receivedLevelMap: unknown): boolean {
  return !!receivedLevelMap && typeof receivedLevelMap === 'object' && !Array.isArray(receivedLevelMap)
    && Object.entries(receivedLevelMap).every(([levelEntryKey, levelEntryValue]) =>
      levelEntryKey.length > 0 && Number.isSafeInteger(levelEntryValue) && (levelEntryValue as number) >= 0);
}
export function parseBorrowedLoanPage(rawResponseValue: unknown): BorrowedLoanPage {
  const receivedLoanPage = rawResponseValue as BorrowedLoanPage;
  if (!receivedLoanPage || !Number.isFinite(receivedLoanPage.serverTime) || !Array.isArray(receivedLoanPage.entries)
      || !(receivedLoanPage.nextCursor === null || typeof receivedLoanPage.nextCursor === 'string' && receivedLoanPage.nextCursor.length > 0)) {
    throw new Error('대여 목록 응답 형식이 올바르지 않습니다.');
  }
  const observedLoanIdentifiers = new Set<string>();
  for (const receivedLoanEntry of receivedLoanPage.entries) {
    if (!receivedLoanEntry || typeof receivedLoanEntry.id !== 'string' || !receivedLoanEntry.id
        || observedLoanIdentifiers.has(receivedLoanEntry.id) || typeof receivedLoanEntry.name !== 'string' || !receivedLoanEntry.name.trim()
        || !Number.isFinite(receivedLoanEntry.startedAt) || !Number.isFinite(receivedLoanEntry.expiresAt)
        || receivedLoanEntry.expiresAt <= receivedLoanEntry.startedAt
        || typeof receivedLoanEntry.expired !== 'boolean' || typeof receivedLoanEntry.inBattle !== 'boolean'
        || !Number.isSafeInteger(receivedLoanEntry.hp) || !Number.isSafeInteger(receivedLoanEntry.maxHp)
        || receivedLoanEntry.hp < 0 || receivedLoanEntry.maxHp <= 0 || receivedLoanEntry.hp > receivedLoanEntry.maxHp
        || !validateLoanLevelMap(receivedLoanEntry.attributes) || !validateLoanLevelMap(receivedLoanEntry.skills)) {
      throw new Error('대여 캐릭터 정보가 올바르지 않습니다.');
    }
    observedLoanIdentifiers.add(receivedLoanEntry.id);
  }
  return receivedLoanPage;
}
