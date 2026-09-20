import { useTranslation } from '../i18n';
import type { PartyRewardReportData } from '../client/types';

export function PartyRewardReport({ rewardReportData }: { rewardReportData: PartyRewardReportData }) {
  const { t: translateRewardText, locale: selectedLocaleCode } = useTranslation();
  return <section class="party-reward-report">
    <h3>{translateRewardText('battle.distributionTitle')}</h3>
    {rewardReportData.materials.length === 0 && <p>{translateRewardText('battle.noLoot')}</p>}
    {rewardReportData.materials.map(materialReportEntry => <article key={materialReportEntry.materialId}>
      <h4>{materialReportEntry.nameTranslations[selectedLocaleCode]}</h4>
      <p>{translateRewardText('battle.distributionQuantities', { total: materialReportEntry.quantity, mine: materialReportEntry.mineQuantity })}</p>
      <ul>{materialReportEntry.recipients.map(recipientReportEntry => <li key={recipientReportEntry.id}>
        <span>{recipientReportEntry.name} · {translateRewardText(recipientReportEntry.role === 'initiator' ? 'battle.distributionInitiator' : 'battle.distributionSupporter')}</span>
        <strong>×{recipientReportEntry.quantity}</strong>
      </li>)}</ul>
      <details><summary>{translateRewardText('battle.distributionDetails')}</summary>
        <ol>{materialReportEntry.allocations.map(allocationReportEntry => <li key={allocationReportEntry.itemSequence}>
          {translateRewardText('battle.distributionRoll', { sequence: allocationReportEntry.itemSequence,
            face: allocationReportEntry.diceFace,
            name: materialReportEntry.recipients.find(recipientReportEntry => recipientReportEntry.id === allocationReportEntry.recipientId)!.name })}
        </li>)}</ol>
      </details>
    </article>)}
    {rewardReportData.materials.some(materialReportEntry => materialReportEntry.recipients.some(recipientReportEntry => recipientReportEntry.role === 'supporter')) &&
      <p class="party-reward-note">{translateRewardText('battle.distributionMailbox')}</p>}
  </section>;
}
