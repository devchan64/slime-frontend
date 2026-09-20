const STANDING_PHASE_HASH_SEED = 2166136261;
const STANDING_PHASE_HASH_PRIME = 16777619;
const STANDING_PHASE_HASH_MIX = 0x85ebca6b;
const STANDING_PHASE_HASH_RANGE = 4294967296;

/** 개체 ID로 고정한 재생 시차. 재그리기·방향·카메라 회전에 영향받지 않는다. */
export function calculateStandingPhase(actorStableIdentifier: string, standingCycleDuration: number): number {
  if (!actorStableIdentifier.trim()) throw new Error("스탠딩 재생에는 개체 ID가 필요합니다.");
  if (!Number.isSafeInteger(standingCycleDuration) || standingCycleDuration <= 0)
    throw new Error("스탠딩 반복 시간은 양의 정수여야 합니다.");
  let accumulatedIdentifierHash = STANDING_PHASE_HASH_SEED;
  for (const identifierCharacterValue of actorStableIdentifier) {
    accumulatedIdentifierHash = Math.imul(accumulatedIdentifierHash ^ identifierCharacterValue.codePointAt(0)!, STANDING_PHASE_HASH_PRIME);
  }
  accumulatedIdentifierHash ^= accumulatedIdentifierHash >>> 16;
  accumulatedIdentifierHash = Math.imul(accumulatedIdentifierHash, STANDING_PHASE_HASH_MIX);
  accumulatedIdentifierHash ^= accumulatedIdentifierHash >>> 13;
  return Math.floor((accumulatedIdentifierHash >>> 0) / STANDING_PHASE_HASH_RANGE * standingCycleDuration);
}
