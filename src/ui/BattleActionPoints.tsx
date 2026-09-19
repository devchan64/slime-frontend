import { useTranslation } from '../i18n';
import type { Battle, Position } from '../client/types';
import { actionPoints, actionPointSubject } from './battleActionPoints';

export function BattleActionPoints({ battle, selected }: { battle: Battle; selected: Position | null }) {
  const { t } = useTranslation();
  const subject = actionPointSubject(battle, selected);
  if (!subject) return null;
  const points = actionPoints(subject.unit);
  return <div class="battle-action-points" aria-label={t('battle.characterAp')} role="status" aria-live="polite" aria-atomic="true">
    <div><small>{t(subject.labelKey)}</small><strong>{subject.unit.name}</strong></div>
    <span class={points?.value === 0 ? 'ap-empty' : ''}>
      {points ? <>{t('battle.remainingAp')} <b>{points.value}</b>{points.maximum !== undefined && <small> / {points.maximum}</small>}</> : t('battle.apUnknown')}
    </span>
  </div>;
}
