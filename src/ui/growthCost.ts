/** 지급 당시 기준 레벨을 제외한 실제 성장 횟수를 합산한다. */
export function growthCost(attributes: Record<string, number>, skills: Record<string, number>, baselines: Record<string, number> = {}) {
  const levels = Object.values(attributes);
  if (levels.some(level => !Number.isSafeInteger(level) || level < 1)) throw new Error('성장 레벨이 올바르지 않습니다.');
  let count = levels.reduce((sum, level) => sum + level - 1, 0);
  for (const [key, level] of Object.entries(skills)) {
    const baseline = baselines[key] ?? 1; // 이전 API의 지급 기준
    if (![0, 1].includes(baseline) || !Number.isSafeInteger(level) || level < baseline) throw new Error('스킬 성장 레벨이 올바르지 않습니다.');
    count += level - baseline;
  }
  if (!Number.isSafeInteger(count)) throw new Error('성장 횟수가 표시 범위를 벗어났습니다.');
  const cost = 2 ** count;
  return { count, cost, label: Number.isFinite(cost) ? String(cost) : `2^${count}` };
}
