const ESTIMATE_STEPS = 4;

// 정확한 정보 확인 권한이 없으면 같은 구간의 HP 변화는 게이지에 드러내지 않는다.
export function healthDisplayRatio(hp: number, maxHp: number, precise: boolean): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0 || hp < 0 || hp > maxHp) {
    throw new Error('체력 표시 값이 올바르지 않습니다.');
  }
  const ratio = hp / maxHp;
  return precise ? ratio : Math.ceil(ratio * ESTIMATE_STEPS) / ESTIMATE_STEPS;
}
