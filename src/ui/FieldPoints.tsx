import { useTranslation } from '../i18n';
export function FieldPoints({fp,max,hp,maxHp,healthRecoveryPending,nextChargeAt,now}:{fp?:number;max?:number;hp?:number;maxHp?:number;healthRecoveryPending?:boolean;nextChargeAt?:number|null;now:number}) {
  const { t } = useTranslation();
  const recovery = nextChargeAt == null ? t('field.maximum') : t('field.next', { seconds: Math.max(0, Math.ceil(nextChargeAt-now)) });
  return <div class="field-points" aria-label={t('field.resources')}>
    <div class="field-resource-values"><strong>HP {hp === undefined || maxHp === undefined ? t('field.healthUnknown') : `${hp} / ${maxHp}`}</strong>
    <strong title={recovery} aria-label={`FP ${fp === undefined ? t('field.connecting') : `${fp} / ${max}`} · ${recovery}`}>FP {fp === undefined ? t('field.connecting') : `${fp} / ${max}`}</strong></div>
    {healthRecoveryPending && <small role="status">{t("field.recoveryPending")}</small>}
    {fp !== undefined && fp < 0 && <small role="status">{t("field.debt")}</small>}
  </div>;
}
