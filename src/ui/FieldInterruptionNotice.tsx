import type { State } from '../client/types';
import { useTranslation } from '../i18n';

/** 현재 전투와 연결된 서버 확정 중단 사유만 표시한다. */
export function FieldInterruptionNotice({ interruption, battleId }: {
  interruption: State['me']['lastFieldInterruption']; battleId: string | null | undefined;
}) {
  const { t } = useTranslation();
  if (!battleId || interruption?.battleId !== battleId || interruption.reason !== 'AGGRO') return null;
  return <p class="result" role="status">{t('field.aggroInterruption')}</p>;
}
