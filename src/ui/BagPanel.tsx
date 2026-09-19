import type { State } from "../client/types";
import { useTranslation } from "../i18n";

export function BagPanel({ me }: { me: State["me"] }) {
  const { t, locale } = useTranslation();
  const bag = me.bag;
  if (!bag) return <p role="status">{t('app.bagUnavailable')}</p>;
  return <section class="bag-panel" aria-label={t('app.bag')}>
    <p class="bag-weight">{t('app.bagWeight', {weight: bag.knownWeightG.toLocaleString(locale), capacity: bag.capacityG.toLocaleString(locale)})}</p>
    {bag.unknownWeightQuantity > 0 && <p>{t('app.bagUnknownWeight', {count: bag.unknownWeightQuantity})}</p>}
    {!bag.items.length ? <p>{t('app.emptyBag')}</p> : <ul class="bag-items">
      {bag.items.map(item => <li key={item.id}>
        <div><strong>{item.nameTranslations[locale]}</strong><span>×{item.quantity}</span></div>
        {locale === "ko" && <p>{item.description}</p>}
        {item.weightG !== null && <p>{t('app.itemWeight', {weight: item.weightG})}</p>}
        {item.valueP !== null && <small>{t('battle.materialValue', { value: item.valueP })}</small>}
      </li>)}
    </ul>}
  </section>;
}
