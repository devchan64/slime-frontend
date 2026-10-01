import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseSubstituteHuntCatalog,type SubstituteHuntCatalog,type SubstituteHuntReceipt} from '../client/substituteHunt';
import {currentHuntSessionIdentity,getSubstituteHuntCommand} from '../client/substituteHuntCommand';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';
const HUNT_UNAVAILABLE_LABELS:Record<string,string>={INVALID_STATE:'hunts.invalidState',FIRST_HUNT_REQUIRED:'hunts.firstRequired',INSUFFICIENT_FP:'hunts.fpRequired'};
export function SubstituteHuntPanel({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}){
 const {t:translateHuntText,locale:currentHuntLocale}=useTranslation();
 const [currentHuntCatalog,setCurrentHuntCatalog]=useState<SubstituteHuntCatalog|null>(null);
 const [currentHuntNotice,setCurrentHuntNotice]=useState<Notice>('');
 const [currentHuntReceipt,setCurrentHuntReceipt]=useState<SubstituteHuntReceipt|null>(null);
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const currentMountedReference=useRef(true);
 const currentBusyReference=useRef(false);
 const currentSessionReference=useRef(currentHuntSessionIdentity(gameSessionClient));
 const currentHuntController=getSubstituteHuntCommand(gameSessionClient);
 function matchesHuntSession(){return currentMountedReference.current&&currentSessionReference.current===currentHuntSessionIdentity(gameSessionClient);}
 async function loadHuntCatalog(){
  if(currentBusyReference.current)return;
  currentBusyReference.current=true;setCurrentRequestPending(true);
  try{const currentCatalogResponse=parseSubstituteHuntCatalog(await gameSessionClient.request('/v1/game/substitute-hunts/catalog'));if(matchesHuntSession())setCurrentHuntCatalog(currentCatalogResponse);}
  catch(currentRequestError){if(matchesHuntSession())setCurrentHuntNotice(currentRequestError as Error);}
  finally{currentBusyReference.current=false;if(matchesHuntSession())setCurrentRequestPending(false);}
 }
 async function executeHuntSelection(currentEncounterIdentifier:string){
  if(actionsAreDisabled||currentBusyReference.current||!matchesHuntSession()||(!currentHuntCatalog&&!currentHuntController.pendingHuntRequest))return;
  currentBusyReference.current=true;setCurrentRequestPending(true);setCurrentHuntNotice('');
  try{
   const currentCommandReceipt=await currentHuntController.executeHuntCommand(currentEncounterIdentifier,currentHuntCatalog?.characterVersion??currentHuntController.pendingHuntRequest!.expectedVersion);
   if(matchesHuntSession()){setCurrentHuntReceipt(currentCommandReceipt);setCurrentHuntCatalog(null);}
  }catch(currentRequestError){if(matchesHuntSession()){setCurrentHuntNotice(currentRequestError as Error);setCurrentHuntCatalog(null);}}
  finally{currentBusyReference.current=false;if(matchesHuntSession()){setCurrentRequestPending(false);if(!currentHuntController.pendingHuntRequest)void loadHuntCatalog();}}
 }
 useEffect(()=>{void loadHuntCatalog();return()=>{currentMountedReference.current=false;};},[]);
 return <section aria-label={translateHuntText('hunts.substituteTitle')}>
  <h3>{translateHuntText('hunts.substituteTitle')}</h3><p>{translateHuntText('hunts.substituteHelp')}</p>
  <button class="secondary compact" disabled={currentRequestPending||actionsAreDisabled} onClick={()=>void loadHuntCatalog()}>{translateHuntText('hunts.refreshTargets')}</button>
  {currentRequestPending&&<p role="status">{translateHuntText('hunts.processing')}</p>}
  {currentHuntNotice&&<p role="alert">{noticeText(currentHuntNotice,currentHuntLocale,translateHuntText)}</p>}
  {currentHuntController.pendingHuntRequest&&<p>{translateHuntText('hunts.uncertain')} <button disabled={currentRequestPending||actionsAreDisabled} onClick={()=>void executeHuntSelection(currentHuntController.pendingHuntRequest!.encounterId)}>{translateHuntText('hunts.retry')}</button></p>}
  {currentHuntCatalog&&<><p>{translateHuntText('hunts.fpBalance',{amount:currentHuntCatalog.fp})}</p><ul class="bag-items">{currentHuntCatalog.encounters.map(currentEncounterEntry=><li key={currentEncounterEntry.encounterId}>
   <strong>{currentEncounterEntry.nameTranslations[currentHuntLocale]} × {currentEncounterEntry.enemyCount}</strong><p>{translateHuntText('hunts.fpCost',{amount:currentEncounterEntry.fpCost})}</p>
   {currentEncounterEntry.unavailableReason&&<p>{translateHuntText(HUNT_UNAVAILABLE_LABELS[currentEncounterEntry.unavailableReason])}</p>}
   <button disabled={actionsAreDisabled||currentRequestPending||!!currentHuntController.pendingHuntRequest||!currentEncounterEntry.available} onClick={()=>void executeHuntSelection(currentEncounterEntry.encounterId)}>{translateHuntText('hunts.execute')}</button>
  </li>)}</ul></>}
  {currentHuntReceipt&&<div role="status"><p>{translateHuntText('hunts.completed',{amount:currentHuntReceipt.substituteHunt.fpConsumed})}</p>{currentHuntReceipt.substituteHunt.materials.length?<ul>{currentHuntReceipt.substituteHunt.materials.map(currentMaterialEntry=><li key={currentMaterialEntry.materialId}>{gameSessionClient.state?.me.bag?.items.find(currentBagEntry=>currentBagEntry.id===currentMaterialEntry.materialId)?.nameTranslations[currentHuntLocale]??currentMaterialEntry.materialId} × {currentMaterialEntry.quantity}</li>)}</ul>:<p>{translateHuntText('hunts.emptyDrop')}</p>}</div>}
 </section>;
}
