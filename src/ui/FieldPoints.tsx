import { useTranslation } from '../i18n';
export function FieldPoints({fp,max,nextChargeAt,now}:{fp?:number;max?:number;nextChargeAt?:number|null;now:number}) {
  const { t } = useTranslation();
  return <div class="field-points" aria-label={t('field.points')}>
    <strong>FP {fp === undefined ? t('field.connecting') : `${fp} / ${max}`}</strong>
    <small>{nextChargeAt == null ? t('field.maximum') : t('field.next', { seconds: Math.max(0, Math.ceil(nextChargeAt-now)) })}</small>
  </div>;
}
