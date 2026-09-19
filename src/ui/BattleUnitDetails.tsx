import { useTranslation } from '../i18n';
import type { Unit } from '../client/types';
import { healthDisplay } from '../game/terrain/healthDisplay';
import { actionPoints } from './battleActionPoints';

/** 선택 정보는 맵을 가리지 않는 하단 설명 영역에서 제공한다. */
export function BattleUnitDetails({unit, monsterLoreLevel}: {unit?: Unit; monsterLoreLevel: number}) {
  const { t } = useTranslation();
  if (!unit) return <div class="battle-unit-details" aria-label={t('battle.unitDetails')}>{t('battle.selectUnitHelp')}</div>;
  const health = healthDisplay(unit, monsterLoreLevel);
  const points = unit.side === 'ally' ? actionPoints(unit) : null;
  return <section class="battle-unit-details" aria-label={t('battle.unitDetails')} aria-live="polite">
    <strong>{unit.side === 'ally' ? t('battle.ally') : t('battle.enemy')} · {unit.name}</strong>
    <p>{t(health.labelKey, health.values)} · {unit.hp <= 0 ? t('battle.incapacitated') : unit.guard ? t('battle.guarding') : t('battle.noGuard')}</p>
    {unit.side === 'ally' && <>
      <p>{points ? t(points.maximum === undefined ? 'battle.apValue' : 'battle.apMaximum', points.maximum === undefined ? {value:points.value} : {value:points.value,maximum:points.maximum}) : t('battle.apUnknown')}</p>
      <p>{t('battle.unitStats',{attack:unit.attack,defense:unit.defense,speed:unit.speed,move:unit.move,range:unit.range.join('~')})}</p>
    </>}
  </section>;
}
