import { growthCost } from "./growthCost";

type GrowthPoints = {
  cp: number;
  sp?: number;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  skillGrowthBaselines?: Record<string, number>;
};

/** 자원별 성장 비용으로 배분 가능한 잔고만 입장 확인에 표시한다. */
export function unallocatedPoints({ cp, sp, attributes, skills, skillGrowthBaselines }: GrowthPoints): string {
  const cpCost = growthCost("attributes", attributes, skills, skillGrowthBaselines).cost;
  const spCost = growthCost("skills", attributes, skills, skillGrowthBaselines).cost;
  const balances = [
    ["CP", cp, Object.keys(attributes).length > 0, cpCost],
    ["SP", sp, Object.keys(skills).length > 0, spCost],
  ] as const;
  return balances.flatMap(([name, value, hasTarget, cost]) => {
    // SP가 없는 이전 API 응답에는 가상의 잔액을 표시하지 않는다.
    if (value === undefined && name === "SP") return [];
    if (!Number.isSafeInteger(value) || value! < 0) throw new Error(`${name} 잔액이 올바르지 않습니다.`);
    return hasTarget && value! >= cost ? [`${value} ${name}`] : [];
  }).join(" · ");
}
