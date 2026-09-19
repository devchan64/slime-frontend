import { useTranslation } from '../i18n';
const TYPES = [
  { kind: "grass", icon: "⋎", name: "풀밭" },
  { kind: "dew", icon: "≈", name: "이슬 지면" },
  { kind: "flowers", icon: "✿", name: "꽃밭" },
  { kind: "road", icon: "─", name: "흙길" },
] as const;

export function TerrainLegend() {
  const { t } = useTranslation();
  return <div class="terrain-legend" aria-label={t('field.legend')}>
    {TYPES.map(({ kind, icon, name }) => <span key={kind}><b class={`legend-${kind}`} aria-hidden="true">{icon}</b>{t(`field.${kind}`)}</span>)}
    <small>{t('field.guidance')}</small>
  </div>;
}
