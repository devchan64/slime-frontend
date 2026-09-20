export type AccountRewardEntry = {id: string; storedAt: number; expiresAt: number; materials: Array<{materialId: string; quantity: number; nameTranslations: Record<'ko' | 'en', string>}>};
export type AccountRewardPage = {serverTime: number; nextCursor: string | null; entries: AccountRewardEntry[]};
export const REWARD_CLOCK_INTERVAL_MS = 1000;
const MILLISECONDS_PER_SECOND = 1000;

export function rewardRemainingSeconds(rewardExpirySeconds: number, serverAnchorSeconds: number, elapsedClockMilliseconds: number): number {
  return Math.max(0, rewardExpirySeconds - serverAnchorSeconds - Math.max(0, elapsedClockMilliseconds) / MILLISECONDS_PER_SECOND);
}

export function parseAccountRewardPage(rawResponseValue: unknown): AccountRewardPage {
  const parsedRewardPage = rawResponseValue as AccountRewardPage;
  if (!parsedRewardPage || !Number.isFinite(parsedRewardPage.serverTime)
      || !(parsedRewardPage.nextCursor === null || typeof parsedRewardPage.nextCursor === 'string')
      || !Array.isArray(parsedRewardPage.entries)) throw new Error('계정 보관함 응답 형식이 올바르지 않습니다.');
  const seenRewardIdentifiers = new Set<string>();
  for (const storedRewardEntry of parsedRewardPage.entries) {
    if (!storedRewardEntry || typeof storedRewardEntry.id !== 'string' || !storedRewardEntry.id
        || seenRewardIdentifiers.has(storedRewardEntry.id) || !Number.isFinite(storedRewardEntry.storedAt)
        || !Number.isFinite(storedRewardEntry.expiresAt) || storedRewardEntry.expiresAt <= storedRewardEntry.storedAt
        || !Array.isArray(storedRewardEntry.materials) || !storedRewardEntry.materials.length)
      throw new Error('계정 보관함 보상 정보가 올바르지 않습니다.');
    seenRewardIdentifiers.add(storedRewardEntry.id);
    for (const storedMaterialEntry of storedRewardEntry.materials) {
      if (!storedMaterialEntry || typeof storedMaterialEntry.materialId !== 'string'
          || !Number.isSafeInteger(storedMaterialEntry.quantity) || storedMaterialEntry.quantity <= 0
          || !storedMaterialEntry.nameTranslations || !(['ko', 'en'] as const).every(localeCodeValue =>
            typeof storedMaterialEntry.nameTranslations[localeCodeValue] === 'string' && storedMaterialEntry.nameTranslations[localeCodeValue].trim()))
        throw new Error('계정 보관함 물품 정보가 올바르지 않습니다.');
    }
  }
  return parsedRewardPage;
}
