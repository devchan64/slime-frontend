import type { Battle, Position } from '../client/types';
import { actionPoints, actionPointSubject } from './battleActionPoints';

export function BattleActionPoints({ battle, selected }: { battle: Battle; selected: Position | null }) {
  const subject = actionPointSubject(battle, selected);
  if (!subject) return null;
  const points = actionPoints(subject.unit);
  return <div class="battle-action-points" aria-label="캐릭터 AP" role="status" aria-live="polite" aria-atomic="true">
    <div><small>{subject.label}</small><strong>{subject.unit.name}</strong></div>
    <span class={points?.value === 0 ? 'ap-empty' : ''}>
      {points ? <>남은 AP <b>{points.value}</b>{points.maximum !== undefined && <small> / {points.maximum}</small>}</> : 'AP 확인 불가'}
    </span>
  </div>;
}
