import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseEquipmentHistory,type EquipmentHistoryPage} from '../client/equipmentHistory';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

const EQUIPMENT_HISTORY_LABELS = {ACQUIRED:'historyAcquired',EQUIPPED:'historyEquipped',UNEQUIPPED:'historyUnequipped',REPAIR_RESERVED:'historyRepairReserved',REPAIRED:'historyRepaired',WORN:'historyWorn'} as const;

export function EquipmentHistory({gameSessionClient,equipmentInstanceIdentifier,closeEquipmentHistory}:{
  gameSessionClient:Client; equipmentInstanceIdentifier:string; closeEquipmentHistory:()=>void;
}) {
  const {t:translateHistoryText,locale:currentLocaleCode}=useTranslation();
  const [currentHistoryPage,setCurrentHistoryPage]=useState<EquipmentHistoryPage|null>(null);
  const [currentRequestNotice,setCurrentRequestNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const activeRequestSequence=useRef(0);
  const historySectionElement=useRef<HTMLElement>(null);
  const initialHistoryRevealed=useRef(false);
  async function loadEquipmentHistory(beforeInstanceVersion?:number) {
    const currentRequestSequence=++activeRequestSequence.current;
    const currentSessionGeneration=gameSessionClient.state?.generation;
    const currentCharacterIdentifier=gameSessionClient.state?.me.id;
    setCurrentRequestPending(true);setCurrentRequestNotice('');
    try {
      const receivedHistoryPage=parseEquipmentHistory(await gameSessionClient.request(`/v1/game/equipment/${encodeURIComponent(equipmentInstanceIdentifier)}/history`
        +(beforeInstanceVersion ? `?before=${beforeInstanceVersion}` : '')),equipmentInstanceIdentifier);
      if(activeRequestSequence.current!==currentRequestSequence || gameSessionClient.state?.generation!==currentSessionGeneration
          || gameSessionClient.state?.me.id!==currentCharacterIdentifier) return;
      if(beforeInstanceVersion && receivedHistoryPage.items.some(currentHistoryRecord=>currentHistoryRecord.after.stateVersion>=beforeInstanceVersion)) {
        throw new Error(translateHistoryText('equipment.historyChanged'));
      }
      setCurrentHistoryPage({...receivedHistoryPage,items:[...(beforeInstanceVersion?currentHistoryPage?.items??[]:[]),...receivedHistoryPage.items]});
    } catch(currentRequestError) {
      if(activeRequestSequence.current===currentRequestSequence) setCurrentRequestNotice(currentRequestError as Error);
    } finally {if(activeRequestSequence.current===currentRequestSequence) setCurrentRequestPending(false);}
  }
  useEffect(()=>{setCurrentHistoryPage(null);void loadEquipmentHistory();return()=>{activeRequestSequence.current++;};},[equipmentInstanceIdentifier,gameSessionClient]);
  useEffect(()=>{
    if(currentHistoryPage && !initialHistoryRevealed.current) {
      initialHistoryRevealed.current=true;historySectionElement.current?.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  },[currentHistoryPage]);
  return <section ref={historySectionElement} class="equipment-history" aria-label={translateHistoryText('equipment.history')}>
    <h3>{translateHistoryText('equipment.history')}</h3>
    <button class="secondary compact" onClick={closeEquipmentHistory}>{translateHistoryText('equipment.closeHistory')}</button>{' '}
    <button class="secondary compact" disabled={currentRequestPending} onClick={()=>void loadEquipmentHistory()}>{translateHistoryText('equipment.refresh')}</button>
    {currentRequestPending && <p role="status">{translateHistoryText('equipment.loading')}</p>}
    {currentRequestNotice && <p role="alert">{noticeText(currentRequestNotice,currentLocaleCode,translateHistoryText)}</p>}
    {currentHistoryPage && <>
      {!currentHistoryPage.items.length && <p>{translateHistoryText('equipment.noHistory')}</p>}
      <ol class="bag-items">{currentHistoryPage.items.map(currentHistoryRecord=><li key={currentHistoryRecord.recordId}>
        <strong>{translateHistoryText(`equipment.${EQUIPMENT_HISTORY_LABELS[currentHistoryRecord.kind]}`)}</strong>
        <p>{new Date(currentHistoryRecord.createdAt*1000).toLocaleString(currentLocaleCode)}</p>
        <p>{translateHistoryText('equipment.durability')}{' '}{currentHistoryRecord.before && `${currentHistoryRecord.before.currentDurability}/${currentHistoryRecord.before.maxDurability} → `}{currentHistoryRecord.after.currentDurability}/{currentHistoryRecord.after.maxDurability}</p>
      </li>)}</ol>
      {currentHistoryPage.nextBefore && <button class="secondary" disabled={currentRequestPending} onClick={()=>void loadEquipmentHistory(currentHistoryPage.nextBefore!)}>{translateHistoryText('equipment.more')}</button>}
    </>}
  </section>;
}
