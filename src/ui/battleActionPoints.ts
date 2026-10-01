import type { Battle, Position, Unit } from '../client/types';

type ActionPoints = { value: number; maximum?: number };

export function actionPoints(unit: Unit): ActionPoints | null {
  if (unit.ap === undefined) return null;
  if (!Number.isInteger(unit.ap) || (unit.maxAp !== undefined &&
      (!Number.isInteger(unit.maxAp) || unit.maxAp <= 0 || unit.ap > unit.maxAp))) {
    throw new Error('전투 AP 잔고가 올바르지 않습니다.');
  }
  // 지형 추가 비용은 잔고를 음수로 만들 수 있으며 다음 턴 회복에 반영된다.
  return { value: unit.ap, maximum: unit.maxAp };
}

// 선택한 아군을 우선하고, 이동 목적지·적 선택 중에는 현재 행동 아군을 유지한다.
export function actionPointSubject(battle: Battle, selected: Position | null) {
  const selectedAlly = battle.units.find(unit => unit.side === 'ally' && selected &&
    unit.position.column === selected.column && unit.position.row === selected.row);
  if (selectedAlly) return { unit: selectedAlly, labelKey: 'battle.selectedCharacter' };
  const current = battle.units.find(unit => unit.id === battle.order[battle.index] && unit.side === 'ally');
  return current ? { unit: current, labelKey: 'battle.activeCharacter' } : null;
}

export function calculateTurnApRecovery(currentBattleRecord: Battle,currentMaximumPoints: number): number {
  const currentRecoveryPolicy=currentBattleRecord.apRecoveryPolicyVersion===undefined?1:currentBattleRecord.apRecoveryPolicyVersion;
  if (![1,2].includes(currentRecoveryPolicy)||!Number.isSafeInteger(currentMaximumPoints)||currentMaximumPoints<=0) {
    throw new Error('AP 회복 정책 또는 최대 AP가 올바르지 않습니다.');
  }
  return Math.floor((currentMaximumPoints+(currentRecoveryPolicy===1?1:0))/2);
}
