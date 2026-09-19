import { useTranslation } from '../i18n';
export function FieldPoints({fp,max,hp,maxHp,nextChargeAt,now}:{fp?:number;max?:number;hp?:number;maxHp?:number;nextChargeAt?:number|null;now:number}) {
  const { t } = useTranslation();
  return <div class="field-points" aria-label={t('field.resources')}>
    <div class="field-resource-values"><strong>HP {hp === undefined || maxHp === undefined ? t('field.healthUnknown') : `${hp} / ${maxHp}`}</strong>
    <strong>FP {fp === undefined ? t('field.connecting') : `${fp} / ${max}`}</strong></div>
    {fp !== undefined && fp < 0 && <small role="status">{t("field.debt")}</small>}
    <small>{nextChargeAt == null ? t('field.maximum') : t('field.next', { seconds: Math.max(0, Math.ceil(nextChargeAt-now)) })}</small>
  </div>;
}
