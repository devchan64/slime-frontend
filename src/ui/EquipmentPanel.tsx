import { EquipmentHistory } from './EquipmentHistory';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Client } from '../client/api';
import { ApiError } from '../client/response';
import { noticeText, type Notice } from '../client/notice';
import { EQUIPMENT_SLOT_NAMES, parseEquipmentInventory, mergeEquipmentInventoryPages, type EquipmentInventoryPage, type EquipmentInstanceEntry, type EquipmentSlotName, type EquipmentLoadoutCommand } from '../client/equipment';
import { useTranslation } from '../i18n';
import './equipment.css';

const EQUIPMENT_SLOT_LABEL_KEYS = {main_hand:'mainHand', off_hand:'offHand', body:'body', back:'back', feet:'feet', tool:'tool'} as const;
function formatEquipmentDifference(currentBonusDifference: number) {
  return currentBonusDifference >= 0 ? `+${currentBonusDifference}` : String(currentBonusDifference);
}

export function EquipmentPanel({gameSessionClient, actionsAreDisabled, characterStateVersion}: {
  gameSessionClient: Client; actionsAreDisabled: boolean; characterStateVersion: number;
}) {
  const {t: translateEquipmentText, locale: currentLocaleCode} = useTranslation();
  const [historyInstanceIdentifier,setHistoryInstanceIdentifier] = useState<string | null>(null);
  const [currentInventoryPage, setCurrentInventoryPage] = useState<EquipmentInventoryPage | null>(null);
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<EquipmentSlotName>('main_hand');
  const [currentEquipmentNotice, setCurrentEquipmentNotice] = useState<Notice>('');
  const [equipmentRequestPending, setEquipmentRequestPending] = useState(false);
  const [unresolvedEquipmentCommand, setUnresolvedEquipmentCommand] = useState<EquipmentLoadoutCommand | null>(null);
  const equipmentPanelActive = useRef(false);
  const equipmentRequestActive = useRef(false);
  const initialSessionIdentity = useRef({owner:gameSessionClient.tokens?.user_id, generation:gameSessionClient.state?.generation});
  function equipmentSessionMatches() {
    return equipmentPanelActive.current && initialSessionIdentity.current.owner === gameSessionClient.tokens?.user_id
      && initialSessionIdentity.current.generation === gameSessionClient.state?.generation;
  }
  async function refreshEquipmentInventory(afterInstanceIdentifier?: string) {
    if (!equipmentSessionMatches()) return;
    const receivedInventoryPage = parseEquipmentInventory(await gameSessionClient.request('/v1/game/equipment'
      + (afterInstanceIdentifier ? `?after=${encodeURIComponent(afterInstanceIdentifier)}` : '')));
    if (!equipmentSessionMatches()) return;
    try {
      setCurrentInventoryPage(mergeEquipmentInventoryPages(currentInventoryPage, receivedInventoryPage, afterInstanceIdentifier));
    } catch (currentInventoryError) {
      setCurrentInventoryPage(null);
      throw currentInventoryError;
    }
  }
  async function loadEquipmentInventory(afterInstanceIdentifier?: string) {
    if (equipmentRequestActive.current || !equipmentSessionMatches()) return;
    equipmentRequestActive.current = true; setEquipmentRequestPending(true); setCurrentEquipmentNotice('');
    try { await refreshEquipmentInventory(afterInstanceIdentifier); }
    catch (currentRequestError) { if (equipmentSessionMatches()) setCurrentEquipmentNotice(currentRequestError as Error); }
    finally {equipmentRequestActive.current = false; if (equipmentSessionMatches()) setEquipmentRequestPending(false);}
  }
  useEffect(() => {equipmentPanelActive.current = true; return () => {equipmentPanelActive.current = false;};}, []);
  useEffect(() => {
    if (!currentInventoryPage || characterStateVersion > currentInventoryPage.characterVersion) void loadEquipmentInventory();
  }, [characterStateVersion]);
  async function submitEquipmentCommand(currentLoadoutCommand: EquipmentLoadoutCommand) {
    if (equipmentRequestActive.current || actionsAreDisabled || !equipmentSessionMatches()) return;
    equipmentRequestActive.current = true; setEquipmentRequestPending(true); setCurrentEquipmentNotice('');
    let equipmentChangeConfirmed = false;
    try {
      await gameSessionClient.request('/v1/game/equipment/loadout', currentLoadoutCommand);
      if (!equipmentSessionMatches()) return;
      equipmentChangeConfirmed = true; setUnresolvedEquipmentCommand(null);
      await refreshEquipmentInventory();
      if (!equipmentSessionMatches()) return;
      const receivedCharacterState = await gameSessionClient.request('/v1/game/state');
      if (equipmentSessionMatches()) {
        gameSessionClient.accept(receivedCharacterState);
        setCurrentEquipmentNotice({key:'equipment.saved'});
      }
    } catch (currentRequestError) {
      if (!equipmentSessionMatches()) return;
      setCurrentEquipmentNotice(currentRequestError as Error);
      if (!equipmentChangeConfirmed && (!(currentRequestError instanceof ApiError) || currentRequestError.status >= 500)) {
        setUnresolvedEquipmentCommand(currentLoadoutCommand);
      } else {
        setUnresolvedEquipmentCommand(null);
        try {await refreshEquipmentInventory();} catch (currentRefreshError) {if (equipmentSessionMatches()) setCurrentEquipmentNotice(currentRefreshError as Error);}
      }
    } finally {equipmentRequestActive.current = false; if (equipmentSessionMatches()) setEquipmentRequestPending(false);}
  }
  function selectEquipmentInstance(currentInstanceEntry: EquipmentInstanceEntry | null) {
    if (!currentInventoryPage || unresolvedEquipmentCommand) return;
    void submitEquipmentCommand({requestId:crypto.randomUUID(), expectedVersion:currentInventoryPage.characterVersion,
      slot:selectedEquipmentSlot, instanceId:currentInstanceEntry?.instanceId ?? null, expectedInstanceVersion:currentInstanceEntry?.stateVersion ?? null});
  }
  const equipmentActionsLocked = actionsAreDisabled || equipmentRequestPending || !!unresolvedEquipmentCommand;
  const selectedSlotEquipment = currentInventoryPage?.slots[selectedEquipmentSlot];
  const matchingEquipmentItems = currentInventoryPage?.items.filter(currentItemEntry => currentItemEntry.slot === selectedEquipmentSlot) ?? [];
  return <section class="equipment-panel" aria-label={translateEquipmentText('equipment.title')}>
    <header><h3>{translateEquipmentText('equipment.title')}</h3><button class="secondary" disabled={equipmentActionsLocked} onClick={() => void loadEquipmentInventory()}>{translateEquipmentText('equipment.refresh')}</button></header>
    {currentEquipmentNotice && <p role={currentEquipmentNotice instanceof Error ? 'alert' : 'status'}>{noticeText(currentEquipmentNotice,currentLocaleCode,translateEquipmentText)}</p>}
    {unresolvedEquipmentCommand && <div role="status"><p>{translateEquipmentText('equipment.uncertain')}</p><button disabled={actionsAreDisabled || equipmentRequestPending} onClick={() => void submitEquipmentCommand(unresolvedEquipmentCommand)}>{translateEquipmentText('equipment.retry')}</button></div>}
    {equipmentRequestPending && <p role="status">{translateEquipmentText('equipment.loading')}</p>}
    {currentInventoryPage && <>
      <p class="growth-help">{translateEquipmentText('equipment.weight', {weight:currentInventoryPage.knownEquipmentWeightG})}</p>
      <div class="equipment-slots" role="group" aria-label={translateEquipmentText('equipment.slots')}>
        {EQUIPMENT_SLOT_NAMES.map(currentSlotName => <button key={currentSlotName} class="secondary" aria-pressed={selectedEquipmentSlot === currentSlotName} onClick={() => setSelectedEquipmentSlot(currentSlotName)}>
          <strong>{translateEquipmentText(`equipment.${EQUIPMENT_SLOT_LABEL_KEYS[currentSlotName]}`)}</strong><span>{currentInventoryPage.slots[currentSlotName]?.nameTranslations[currentLocaleCode] ?? translateEquipmentText('equipment.emptySlot')}</span>
        </button>)}
      </div>
      <div class="equipment-current"><strong>{translateEquipmentText(`equipment.${EQUIPMENT_SLOT_LABEL_KEYS[selectedEquipmentSlot]}`)} · {selectedSlotEquipment?.nameTranslations[currentLocaleCode] ?? translateEquipmentText('equipment.emptySlot')}</strong>
        {selectedSlotEquipment && <button class="secondary" disabled={equipmentActionsLocked} onClick={() => selectEquipmentInstance(null)}>{translateEquipmentText('equipment.unequip')}</button>}
      </div>
      <ul class="equipment-inventory">{matchingEquipmentItems.map(currentItemEntry => <li key={currentItemEntry.instanceId}>
        <div><h4>{currentItemEntry.nameTranslations[currentLocaleCode]}</h4><p>{currentItemEntry.description}</p>
          <dl><div><dt>{translateEquipmentText('equipment.durability')}</dt><dd>{currentItemEntry.currentDurability}/{currentItemEntry.maxDurability}</dd></div>
          <div><dt>{translateEquipmentText('equipment.itemWeight')}</dt><dd>{currentItemEntry.weightG} g</dd></div>
          <div><dt>{translateEquipmentText('equipment.attack')}</dt><dd>+{currentItemEntry.statBonus.attackFlat}</dd></div>
          <div><dt>{translateEquipmentText('equipment.defense')}</dt><dd>+{currentItemEntry.statBonus.defenseFlat}</dd></div></dl>
          {!currentItemEntry.equippedSlot && <p>{translateEquipmentText('equipment.comparison', {
            attack:formatEquipmentDifference(currentItemEntry.statBonus.attackFlat - (selectedSlotEquipment?.statBonus.attackFlat ?? 0)),
            defense:formatEquipmentDifference(currentItemEntry.statBonus.defenseFlat - (selectedSlotEquipment?.statBonus.defenseFlat ?? 0)),
          })}</p>}
        </div>
        <div class="equipment-item-actions"><button class="secondary compact" onClick={() => setHistoryInstanceIdentifier(currentItemEntry.instanceId)}>{translateEquipmentText('equipment.history')}</button>
        <button disabled={equipmentActionsLocked || currentItemEntry.reserved || currentItemEntry.currentDurability === 0 || currentItemEntry.equippedSlot !== null}
          onClick={() => selectEquipmentInstance(currentItemEntry)}>{translateEquipmentText(currentItemEntry.reserved ? 'equipment.reserved' : currentItemEntry.equippedSlot ? 'equipment.equipped' : currentItemEntry.currentDurability === 0 ? 'equipment.broken' : 'equipment.equip')}</button></div>
      </li>)}</ul>
      {matchingEquipmentItems.length === 0 && <p>{translateEquipmentText('equipment.noItems')}</p>}
      {currentInventoryPage.nextCursor && <button class="secondary" disabled={equipmentActionsLocked} onClick={() => void loadEquipmentInventory(currentInventoryPage.nextCursor!)}>{translateEquipmentText('equipment.more')}</button>}
    </>}
    {historyInstanceIdentifier && <EquipmentHistory key={historyInstanceIdentifier} gameSessionClient={gameSessionClient} equipmentInstanceIdentifier={historyInstanceIdentifier} closeEquipmentHistory={() => setHistoryInstanceIdentifier(null)} />}
  </section>;
}
