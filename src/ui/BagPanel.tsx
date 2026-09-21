import {SkillbookPanel} from './SkillbookPanel';
import { EquipmentHistory } from './EquipmentHistory';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { State } from '../client/types';
import type { Client } from '../client/api';
import { parseBagInventory, type BagInventoryPage } from '../client/bag';
import { LocalizedError, noticeText, type Notice } from '../client/notice';
import { useTranslation } from '../i18n';

export function BagPanel({me, gameSessionClient, actionsAreDisabled = true, submitConsumableUse}: {
  me: State['me']; gameSessionClient: Client; actionsAreDisabled?: boolean; submitConsumableUse?: (currentItemIdentifier: string) => unknown;
}) {
  const {t: translateBagText, locale: currentLocaleCode} = useTranslation();
  const [historyInstanceIdentifier,setHistoryInstanceIdentifier] = useState<string | null>(null);
  const [currentInventoryPage,setCurrentInventoryPage] = useState<BagInventoryPage | null>(null);
  const [currentRequestNotice,setCurrentRequestNotice] = useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending] = useState(false);
  const activeRequestSequence = useRef(0);
  const activePanelReference = useRef(false);
  const initialSessionReference = useRef({owner:gameSessionClient.tokens?.user_id,
    generation:gameSessionClient.state?.generation,character:me.id});
  function matchesBagSession() {
    return activePanelReference.current
      && gameSessionClient.tokens?.user_id === initialSessionReference.current.owner
      && gameSessionClient.state?.generation === initialSessionReference.current.generation
      && gameSessionClient.state?.me.id === initialSessionReference.current.character;
  }
  function useBagConsumable(currentItemIdentifier: string) {
    if (!matchesBagSession() || actionsAreDisabled || currentRequestPending) return;
    submitConsumableUse?.(currentItemIdentifier);
  }
  async function loadBagInventory(afterInstanceIdentifier?: string) {
    if (!matchesBagSession()) return;
    const currentRequestSequence = ++activeRequestSequence.current;
    const currentSessionGeneration = gameSessionClient.state?.generation;
    const currentCharacterIdentifier = me.id;
    const currentAccountIdentifier = gameSessionClient.tokens?.user_id;
    const matchesCurrentRequest = () => activeRequestSequence.current === currentRequestSequence
      && gameSessionClient.state?.generation === currentSessionGeneration
      && gameSessionClient.state?.me.id === currentCharacterIdentifier
      && gameSessionClient.tokens?.user_id === currentAccountIdentifier;
    setCurrentRequestPending(true); setCurrentRequestNotice('');
    try {
      const receivedInventoryPage = parseBagInventory(await gameSessionClient.request('/v1/game/equipment?includeSkillbooks=true'
        + (afterInstanceIdentifier ? `&after=${encodeURIComponent(afterInstanceIdentifier)}` : '')));
      if (!matchesCurrentRequest()) return;
      const previousInventoryItems = afterInstanceIdentifier ? currentInventoryPage?.items ?? [] : [];
      if (afterInstanceIdentifier && receivedInventoryPage.characterVersion !== currentInventoryPage?.characterVersion) {
        throw new LocalizedError('app.bagChanged');
      }
      const previousInstanceIdentifiers = new Set(previousInventoryItems.map(currentItemEntry => currentItemEntry.instanceId));
      if (receivedInventoryPage.items.some(currentItemEntry => previousInstanceIdentifiers.has(currentItemEntry.instanceId))) {
        throw new LocalizedError('app.bagChanged');
      }
      setCurrentInventoryPage({...receivedInventoryPage,items:[...previousInventoryItems,...receivedInventoryPage.items]});
    } catch (currentRequestError) {
      if (matchesCurrentRequest()) {
        setCurrentInventoryPage(null); setCurrentRequestNotice(currentRequestError as Error);
      }
    } finally {
      if (matchesCurrentRequest()) setCurrentRequestPending(false);
    }
  }
  useEffect(() => {
    activePanelReference.current = true;
    setCurrentInventoryPage(null);
    void loadBagInventory();
    return () => {activePanelReference.current = false;activeRequestSequence.current++;};
  }, [me.id, me.version, gameSessionClient]);
  const currentBagSummary = currentInventoryPage?.bag;
  return <section class="bag-panel" aria-label={translateBagText('app.bag')}>
    <button class="secondary compact" disabled={currentRequestPending} onClick={() => void loadBagInventory()}>{translateBagText('equipment.refresh')}</button>
    {currentRequestPending && <p role="status">{translateBagText('app.bagLoading')}</p>}
    {currentRequestNotice && <p role="alert">{noticeText(currentRequestNotice,currentLocaleCode,translateBagText)}</p>}
    {currentBagSummary && currentInventoryPage && <>
      <p class="bag-weight">{translateBagText('app.bagWeight',{weight:currentBagSummary.knownWeightG.toLocaleString(currentLocaleCode),capacity:currentBagSummary.capacityG.toLocaleString(currentLocaleCode)})}</p>
      {currentBagSummary.unknownWeightQuantity > 0 && <p>{translateBagText('app.bagUnknownWeight',{count:currentBagSummary.unknownWeightQuantity})}</p>}
      {!currentBagSummary.items.length && !currentInventoryPage.items.length && !currentInventoryPage.nextCursor && <p>{translateBagText('app.emptyBag')}</p>}
      {currentBagSummary.items.some(currentItemEntry => currentItemEntry.kind !== 'skillbook') && <><h3>{translateBagText('app.bagMaterials')}</h3><ul class="bag-items">
        {currentBagSummary.items.filter(currentItemEntry => currentItemEntry.kind !== 'skillbook').map(currentMaterialEntry => <li key={currentMaterialEntry.id}>
          <div><strong>{currentMaterialEntry.nameTranslations[currentLocaleCode]}</strong><span>×{currentMaterialEntry.quantity}</span></div>
          {currentLocaleCode === 'ko' && <p>{currentMaterialEntry.description}</p>}
          {currentMaterialEntry.weightG !== null && <p>{translateBagText('app.itemWeight',{weight:currentMaterialEntry.weightG})}</p>}
          {currentMaterialEntry.valueP !== null && <small>{translateBagText('battle.materialValue',{value:currentMaterialEntry.valueP})}</small>}
          {currentMaterialEntry.useAction && submitConsumableUse && <button class="secondary compact"
            disabled={actionsAreDisabled || currentRequestPending || me.mode !== 'FIELD' || !!me.battleId || (me.fp ?? 0) < 0
              || (currentMaterialEntry.useAction.type === 'RESTORE_HP' && (me.hp === undefined || me.maxHp === undefined || me.hp >= me.maxHp))
              || currentMaterialEntry.quantity < currentMaterialEntry.useAction.consumedOnSuccess}
            onClick={() => useBagConsumable(currentMaterialEntry.id)}>
            {currentMaterialEntry.useAction.type === 'RESTORE_HP'
              ? translateBagText('app.useHealingItem',{amount:currentMaterialEntry.useAction.restorationHp,count:currentMaterialEntry.useAction.consumedOnSuccess})
              : translateBagText('app.useMarkerItem',{seconds:currentMaterialEntry.useAction.validSeconds,count:currentMaterialEntry.useAction.consumedOnSuccess})}
          </button>}
        </li>)}
      </ul></>}
      {!!currentInventoryPage.items.length && <><h3>{translateBagText('equipment.title')}</h3><ul class="bag-items">
        {currentInventoryPage.items.map(currentEquipmentEntry => <li key={currentEquipmentEntry.instanceId}>
          <div><strong>{currentEquipmentEntry.nameTranslations[currentLocaleCode]}</strong><span>{translateBagText(currentEquipmentEntry.reserved ? 'equipment.reserved' : currentEquipmentEntry.equippedSlot ? 'equipment.equipped' : 'equipment.emptySlot')}</span></div>
          <p>{translateBagText('equipment.durability')} {currentEquipmentEntry.currentDurability}/{currentEquipmentEntry.maxDurability} · {currentEquipmentEntry.weightG} g</p>
          <button class="secondary compact" onClick={() => setHistoryInstanceIdentifier(currentEquipmentEntry.instanceId)}>{translateBagText('equipment.history')}</button>
          {currentEquipmentEntry.currentDurability === 0 && <p>{translateBagText('equipment.broken')}</p>}
        </li>)}
      </ul></>}
      {currentInventoryPage.nextCursor && <button class="secondary" disabled={currentRequestPending} onClick={() => void loadBagInventory(currentInventoryPage.nextCursor!)}>{translateBagText('equipment.more')}</button>}
    </>}
    <SkillbookPanel key={`${me.id}:${gameSessionClient.state?.generation}`} gameSessionClient={gameSessionClient} actionsAreDisabled={actionsAreDisabled}/>
    {historyInstanceIdentifier && <EquipmentHistory key={historyInstanceIdentifier} gameSessionClient={gameSessionClient} equipmentInstanceIdentifier={historyInstanceIdentifier} closeEquipmentHistory={() => setHistoryInstanceIdentifier(null)} />}
  </section>;
}
