import type {Battle, Position} from '../client/types';
export type BattleMode = 'MOVE' | 'ATTACK' | 'END_TURN';

export function defaultBattleMode(battle: Battle, actor: string): BattleMode | null {
  if (battle.status !== 'ACTIVE' || !battle.tactics.canAct || battle.order[battle.index] !== actor) return null;
  const ap = battle.rulesVersion === '1.4.0';
  if (ap && battle.moved && battle.tactics.attacks.length) return 'ATTACK';
  if ((ap || !battle.moved) && battle.tactics.moves.length) return 'MOVE';
  if ((ap || !battle.acted) && battle.tactics.attacks.length) return 'ATTACK';
  return null;
}

// 대상 자동 선택은 공격 진입 시에만 수행하며 공격 명령은 전송하지 않는다.
export function singleAttackTarget(battle: Battle): Position | null {
  if ((battle.rulesVersion !== '1.4.0' && battle.acted) || battle.tactics.attacks.length !== 1) return null;
  const target = battle.units.find(u => u.id === battle.tactics.attacks[0].targetId && u.hp > 0);
  return target ? target.position : null;
}
