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


export type AccountRewardClaimSummary = {claimedCount: number; materialQuantity: number};
export function parseAccountRewardClaim(rawResponseValue: unknown): AccountRewardClaimSummary {
  const receivedClaimResult = rawResponseValue as {claimedCount: number; materials: Array<{materialId: string; quantity: number}>};
  if (!receivedClaimResult || !Number.isSafeInteger(receivedClaimResult.claimedCount) || receivedClaimResult.claimedCount < 0
      || !Array.isArray(receivedClaimResult.materials)) throw new Error('보상 수령 결과가 올바르지 않습니다.');
  const seenMaterialIdentifiers = new Set<string>();
  let claimedMaterialQuantity = 0;
  for (const receivedMaterialEntry of receivedClaimResult.materials) {
    if (!receivedMaterialEntry || typeof receivedMaterialEntry.materialId !== 'string' || !receivedMaterialEntry.materialId.trim()
        || seenMaterialIdentifiers.has(receivedMaterialEntry.materialId) || !Number.isSafeInteger(receivedMaterialEntry.quantity) || receivedMaterialEntry.quantity <= 0)
      throw new Error('수령 재료 ID·수량이 올바르지 않습니다.');
    seenMaterialIdentifiers.add(receivedMaterialEntry.materialId);
    claimedMaterialQuantity += receivedMaterialEntry.quantity;
    if (!Number.isSafeInteger(claimedMaterialQuantity)) throw new Error('수령 재료 합계가 허용 범위를 벗어났습니다.');
  }
  if ((receivedClaimResult.claimedCount === 0) !== (claimedMaterialQuantity === 0)) throw new Error('보상 수령 건수와 재료가 일치하지 않습니다.');
  return {claimedCount: receivedClaimResult.claimedCount, materialQuantity: claimedMaterialQuantity};
}
