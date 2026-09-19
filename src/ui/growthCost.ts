const GROWTH_COST_DIVISOR = 4n;

/** 지급 당시 기준 레벨을 제외한 실제 성장 횟수를 합산한다. */
export function growthCost(category: "attributes" | "skills", attributes: Record<string, number>, skills: Record<string, number>, baselines: Record<string, number> = {}, skillId?: string) {
  if (category === "skills" && (skillId === undefined || !Object.hasOwn(skills, skillId))) throw new Error('비용을 확인할 보유 스킬이 필요합니다.');
  const levels = Object.values(attributes);
  if (levels.some(level => !Number.isSafeInteger(level) || level < 1)) throw new Error('성장 레벨이 올바르지 않습니다.');
  let count = category === "attributes" ? levels.reduce((sum, level) => sum + level - 1, 0) : 0;
  for (const [key, level] of Object.entries(skills)) {
    const baseline = baselines[key] ?? 1; // 이전 API의 지급 기준
    if (![0, 1].includes(baseline) || !Number.isSafeInteger(level) || level < baseline) throw new Error('스킬 성장 레벨이 올바르지 않습니다.');
    if (category === "skills" && key === skillId) count = level - baseline;
  }
  if (!Number.isSafeInteger(count)) throw new Error('성장 횟수가 표시 범위를 벗어났습니다.');
  const step = BigInt(count) + 1n;
  const quadratic = step * step / GROWTH_COST_DIVISOR;
  const exactCost = quadratic > step ? quadratic : step;
  return { count, cost: Number(exactCost), label: String(exactCost) };
}
