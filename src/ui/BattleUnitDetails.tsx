import type { Unit } from '../client/types';
import { healthDisplay } from '../game/terrain/healthDisplay';
import { actionPoints } from './battleActionPoints';

/** 선택 정보는 맵을 가리지 않는 하단 설명 영역에서 제공한다. */
export function BattleUnitDetails({unit, monsterLoreLevel}: {unit?: Unit; monsterLoreLevel: number}) {
  if (!unit) return <div class="battle-unit-details" aria-label="선택 캐릭터 설명">캐릭터를 선택하면 이곳에서 상태를 확인할 수 있습니다.</div>;
  const health = healthDisplay(unit, monsterLoreLevel);
  const points = unit.side === 'ally' ? actionPoints(unit) : null;
  return <section class="battle-unit-details" aria-label="선택 캐릭터 설명" aria-live="polite">
    <strong>{unit.side === 'ally' ? '아군' : '적'} · {unit.name}</strong>
    <p>{health.label} · {unit.hp <= 0 ? '전투 불능' : unit.guard ? '방어 중' : '방어 없음'}</p>
    {unit.side === 'ally' && <>
      <p>{points ? `남은 AP ${points.value}${points.maximum === undefined ? '' : ` / ${points.maximum}`}` : 'AP 확인 불가'}</p>
      <p>공격 {unit.attack} · 방어 {unit.defense} · 속도 {unit.speed} · 이동 {unit.move} · 사거리 {unit.range.join('~')}</p>
    </>}
  </section>;
}
