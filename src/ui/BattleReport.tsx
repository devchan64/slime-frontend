import { useTranslation } from '../i18n';
import { useEffect, useRef, useState } from "preact/hooks";
import type { State } from "../client/types";

export const BATTLE_REPORT_SECONDS = 5;
const RESULT_LABELS: Record<string, string> = {
  WIN: "battle.resultWin", LOSE: "battle.resultLose", TIMEOUT: "battle.resultTimeout", SURRENDER: "battle.resultSurrender",
  PREPARATION_FAILED: "battle.resultPreparationFailed",
};

export function BattleReport({ result, onReturn }: {
  result: NonNullable<State["me"]["lastResult"]>;
  onReturn: () => void;
}) {
  const { t, locale } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const returned = useRef(false);
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;
  const [seconds, setSeconds] = useState(BATTLE_REPORT_SECONDS);
  const finish = () => {
    if (returned.current) return;
    returned.current = true;
    onReturnRef.current();
  };
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const deadline = Date.now() + BATTLE_REPORT_SECONDS * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) finish();
    }, 100);
    return () => { clearInterval(timer); element.close(); };
  }, []);
  return <dialog ref={dialog} class="battle-report" aria-labelledby="battle-report-title"
    onCancel={event => { event.preventDefault(); finish(); }}>
    <h2 id="battle-report-title">{t('battle.reportTitle')}</h2>
    <p class="battle-report-result">{RESULT_LABELS[result.result] ? t(RESULT_LABELS[result.result]) : result.result}</p>
    <dl>{result.coins > 0 && <div><dt>{t('battle.earnedCurrency')}</dt><dd>+{result.coins}p</dd></div>}
      {(result.materials ?? []).map(material => <div key={material.materialId}><dt>{material.nameTranslations[locale]}</dt>
        <dd>×{material.quantity}{material.valueP !== null && <small> · {t('battle.materialValue', {value: material.valueP})}</small>}</dd></div>)}
    </dl>
    {!result.coins && !(result.materials ?? []).length && <p>{t('battle.noLoot')}</p>}
    {!!result.lostMaterials?.length && <section class="battle-lost-loot">
      <h3>{t('battle.lostLoot')}</h3>
      <ul>{result.lostMaterials.map(lostMaterialEntry => <li key={lostMaterialEntry.materialId}>
        {lostMaterialEntry.nameTranslations[locale]} ×{lostMaterialEntry.quantity}
      </li>)}</ul>
    </section>}
    <p role="status">{t('battle.returnCountdown',{seconds})}</p>
    <button autoFocus onClick={finish}>{t('battle.acknowledge')}</button>
  </dialog>;
}
