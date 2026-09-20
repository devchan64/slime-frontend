import { EquipmentHistory } from './EquipmentHistory';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { State } from '../client/types';
import type { Client } from '../client/api';
import { parseBagInventory, type BagInventoryPage } from '../client/bag';
import { noticeText, type Notice } from '../client/notice';
import { useTranslation } from '../i18n';

export function BagPanel({me, gameSessionClient}: {me: State['me']; gameSessionClient: Client}) {
  const {t: translateBagText, locale: currentLocaleCode} = useTranslation();
  const [historyInstanceIdentifier,setHistoryInstanceIdentifier] = useState<string | null>(null);
  const [currentInventoryPage,setCurrentInventoryPage] = useState<BagInventoryPage | null>(null);
  const [currentRequestNotice,setCurrentRequestNotice] = useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending] = useState(false);
  const activeRequestSequence = useRef(0);
  async function loadBagInventory(afterInstanceIdentifier?: string) {
    const currentRequestSequence = ++activeRequestSequence.current;
    const currentSessionGeneration = gameSessionClient.state?.generation;
    const currentCharacterIdentifier = me.id;
    setCurrentRequestPending(true); setCurrentRequestNotice('');
    try {
      const receivedInventoryPage = parseBagInventory(await gameSessionClient.request('/v1/game/equipment'
        + (afterInstanceIdentifier ? `?after=${encodeURIComponent(afterInstanceIdentifier)}` : '')));
      if (activeRequestSequence.current !== currentRequestSequence || gameSessionClient.state?.generation !== currentSessionGeneration
          || gameSessionClient.state?.me.id !== currentCharacterIdentifier) return;
      const previousInventoryItems = afterInstanceIdentifier ? currentInventoryPage?.items ?? [] : [];
      if (afterInstanceIdentifier && receivedInventoryPage.characterVersion !== currentInventoryPage?.characterVersion) {
        throw new Error(translateBagText('app.bagChanged'));
      }
      const previousInstanceIdentifiers = new Set(previousInventoryItems.map(currentItemEntry => currentItemEntry.instanceId));
      if (receivedInventoryPage.items.some(currentItemEntry => previousInstanceIdentifiers.has(currentItemEntry.instanceId))) {
        throw new Error(translateBagText('app.bagChanged'));
      }
      setCurrentInventoryPage({...receivedInventoryPage,items:[...previousInventoryItems,...receivedInventoryPage.items]});
    } catch (currentRequestError) {
      if (activeRequestSequence.current === currentRequestSequence) {
        setCurrentInventoryPage(null); setCurrentRequestNotice(currentRequestError as Error);
      }
    } finally {
      if (activeRequestSequence.current === currentRequestSequence) setCurrentRequestPending(false);
    }
  }
  useEffect(() => {
    setCurrentInventoryPage(null);
    void loadBagInventory();
    return () => {activeRequestSequence.current++;};
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
      {!!currentBagSummary.items.length && <><h3>{translateBagText('app.bagMaterials')}</h3><ul class="bag-items">
        {currentBagSummary.items.map(currentMaterialEntry => <li key={currentMaterialEntry.id}>
          <div><strong>{currentMaterialEntry.nameTranslations[currentLocaleCode]}</strong><span>×{currentMaterialEntry.quantity}</span></div>
          {currentLocaleCode === 'ko' && <p>{currentMaterialEntry.description}</p>}
          {currentMaterialEntry.weightG !== null && <p>{translateBagText('app.itemWeight',{weight:currentMaterialEntry.weightG})}</p>}
          {currentMaterialEntry.valueP !== null && <small>{translateBagText('battle.materialValue',{value:currentMaterialEntry.valueP})}</small>}
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
    {historyInstanceIdentifier && <EquipmentHistory key={historyInstanceIdentifier} gameSessionClient={gameSessionClient} equipmentInstanceIdentifier={historyInstanceIdentifier} closeEquipmentHistory={() => setHistoryInstanceIdentifier(null)} />}
  </section>;
}
