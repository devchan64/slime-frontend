import type {Battle, Position} from '../client/types';
export type BattleMode = 'MOVE' | 'ATTACK' | 'END_TURN';

export function defaultBattleMode(battle: Battle, actor: string, remaining: number): BattleMode | null {
  if (battle.status !== 'ACTIVE' || !battle.tactics.canAct || battle.order[battle.index] !== actor || remaining <= 0) return null;
  if (!battle.moved && battle.tactics.moves.length) return 'MOVE';
  if (!battle.acted && battle.tactics.attacks.length) return 'ATTACK';
  return null;
}

// 대상 자동 선택은 공격 진입 시에만 수행하며 공격 명령은 전송하지 않는다.
export function singleAttackTarget(battle: Battle): Position | null {
  if (battle.acted || battle.tactics.attacks.length !== 1) return null;
  const target = battle.units.find(u => u.id === battle.tactics.attacks[0].targetId && u.hp > 0);
  return target ? target.position : null;
}
