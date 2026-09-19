import type { Unit } from '../../client/types';

type Health = Pick<Unit, 'hp' | 'maxHp' | 'side' | 'healthVisibility'>;
export type HealthDisplay = { ratio: number | null; labelKey: string; values?: { hp: number; maxHp: number } };

// 서버의 표시 스케일과 이전 응답 모두 같은 공개 상한을 적용한다.
export function healthDisplay(health: Health, monsterLoreLevel: number): HealthDisplay {
  const { hp, maxHp, side, healthVisibility } = health;
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0 || hp < 0 || hp > maxHp) {
    throw new Error('체력 표시 값이 올바르지 않습니다.');
  }
  if (!Number.isInteger(monsterLoreLevel) || monsterLoreLevel < 0) {
    throw new Error('몬스터학 레벨은 0 이상의 정수여야 합니다.');
  }
  if (side === 'ally') return { ratio: hp / maxHp, labelKey: 'battle.healthAlly', values: {hp,maxHp} };
  if (healthVisibility !== undefined && healthVisibility !== 'HIDDEN' && healthVisibility !== 'BANDED') {
    throw new Error('지원하지 않는 몬스터 체력 공개 상태입니다.');
  }
  if (hp === 0) return { ratio: null, labelKey: 'battle.healthFallen' };
  if (monsterLoreLevel === 0 || healthVisibility === 'HIDDEN') return { ratio: null, labelKey: 'battle.healthHidden' };
  // 상위 레벨의 정밀도는 미정이므로 확정된 두 단계보다 자세히 공개하지 않는다.
  return hp * 2 > maxHp
    ? { ratio: 1, labelKey: 'battle.healthLight' }
    : { ratio: 0.5, labelKey: 'battle.healthHeavy' };
}
