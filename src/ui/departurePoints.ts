type GrowthPoints = { cp: number; sp?: number };

/** SP가 없는 이전 API 응답에는 가상의 잔액을 표시하지 않는다. */
export function unallocatedPoints({ cp, sp }: GrowthPoints): string {
  const balances = [["CP", cp], ["SP", sp]] as const;
  return balances.flatMap(([name, value]) => {
    if (value === undefined && name === "SP") return [];
    if (!Number.isSafeInteger(value) || value! < 0) throw new Error(`${name} 잔액이 올바르지 않습니다.`);
    return value! > 0 ? [`${value} ${name}`] : [];
  }).join(" · ");
}
