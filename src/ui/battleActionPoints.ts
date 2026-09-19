import type { Battle, Position, Unit } from '../client/types';

type ActionPoints = { value: number; maximum?: number };

export function actionPoints(unit: Unit): ActionPoints | null {
  if (unit.ap === undefined) return null;
  if (!Number.isInteger(unit.ap) || unit.ap < 0 || (unit.maxAp !== undefined &&
      (!Number.isInteger(unit.maxAp) || unit.maxAp <= 0 || unit.ap > unit.maxAp))) {
    throw new Error('전투 AP 잔고가 올바르지 않습니다.');
  }
  return { value: unit.ap, maximum: unit.maxAp };
}

// 선택한 아군을 우선하고, 이동 목적지·적 선택 중에는 현재 행동 아군을 유지한다.
export function actionPointSubject(battle: Battle, selected: Position | null) {
  const selectedAlly = battle.units.find(unit => unit.side === 'ally' && selected &&
    unit.position.column === selected.column && unit.position.row === selected.row);
  if (selectedAlly) return { unit: selectedAlly, label: '선택한 캐릭터' };
  const current = battle.units.find(unit => unit.id === battle.order[battle.index] && unit.side === 'ally');
  return current ? { unit: current, label: '현재 행동 캐릭터' } : null;
}
