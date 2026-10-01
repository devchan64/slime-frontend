import {ApiError} from '../client/response';
import {resolveCostumeActorKind} from '../client/costumeAppearance';
import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseCostumeInventory,type CostumeInventoryPage} from '../client/costumeInventory';
import {noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

export function CostumeInventoryPanel({gameSessionClient,actionsAreDisabled}:{gameSessionClient:Client;actionsAreDisabled:boolean}){
 const {t:translateCostumeText,locale:currentCostumeLocale}=useTranslation();
 const [currentInventoryPage,setCurrentInventoryPage]=useState<CostumeInventoryPage|null>(null);
 const [currentInventoryNotice,setCurrentInventoryNotice]=useState<Notice>('');
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const [currentEquipUncertain,setCurrentEquipUncertain]=useState(false);
 const currentEquipRequest=useRef<{requestId:string;expectedVersion:number;costumeId:string}|null>(null);
 const currentActiveReference=useRef(false),currentPendingReference=useRef(false);
 const currentSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation});
 function costumeInventorySessionMatches(){return currentActiveReference.current&&gameSessionClient.tokens?.user_id===currentSessionReference.current.owner&&gameSessionClient.state?.me.id===currentSessionReference.current.character&&gameSessionClient.state?.generation===currentSessionReference.current.generation;}
 async function loadCostumeInventory(){
  if(actionsAreDisabled||currentPendingReference.current||currentEquipRequest.current||!costumeInventorySessionMatches())return;
  currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentInventoryNotice('');setCurrentInventoryPage(null);
  try{
   const currentResponseRecord=parseCostumeInventory(await gameSessionClient.request('/v1/characters/me/costumes'));
   if(costumeInventorySessionMatches())setCurrentInventoryPage(currentResponseRecord);
  }catch(currentRequestError){if(costumeInventorySessionMatches())setCurrentInventoryNotice(currentRequestError as Error);}
  finally{currentPendingReference.current=false;if(costumeInventorySessionMatches())setCurrentRequestPending(false);}
 }
 function costumeChangeAvailable(){return ['LOBBY','FIELD'].includes(gameSessionClient.state?.me.mode??'')&&!gameSessionClient.state?.me.battleId&&!gameSessionClient.state?.battle;}
 async function equipSelectedCostume(currentCostumeIdentifier:string){
  if(actionsAreDisabled||currentPendingReference.current||!costumeInventorySessionMatches()||!costumeChangeAvailable()||!currentInventoryPage)return;
  const currentRequestRecord=currentEquipRequest.current??{requestId:crypto.randomUUID(),expectedVersion:gameSessionClient.state!.me.version,costumeId:currentCostumeIdentifier};
  if(currentRequestRecord.costumeId!==currentCostumeIdentifier)return;
  currentEquipRequest.current=currentRequestRecord;currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentInventoryNotice('');
  try{
   const currentResponseRecord=await gameSessionClient.request('/v1/characters/me/costume',currentRequestRecord);
   if(currentResponseRecord.requestId!==currentRequestRecord.requestId||currentResponseRecord.state?.me?.id!==currentSessionReference.current.character||currentResponseRecord.state?.generation!==currentSessionReference.current.generation||currentResponseRecord.state?.me?.costumeAppearance?.costumeId!==currentCostumeIdentifier)throw new Error(translateCostumeText('wardrobe.invalidResponse'));
   resolveCostumeActorKind(currentResponseRecord.state.me.costumeAppearance);
   if(!costumeInventorySessionMatches())return;
   gameSessionClient.accept(currentResponseRecord.state);
   currentEquipRequest.current=null;setCurrentEquipUncertain(false);setCurrentInventoryNotice({key:'wardrobe.equipped'});
  }catch(currentRequestError){if(costumeInventorySessionMatches()){
   const currentOutcomeUncertain=!(currentRequestError instanceof ApiError)||currentRequestError.status>=500;
   setCurrentEquipUncertain(currentOutcomeUncertain);
   if(!currentOutcomeUncertain)currentEquipRequest.current=null;
   setCurrentInventoryNotice(currentRequestError as Error);
  }}finally{currentPendingReference.current=false;if(costumeInventorySessionMatches())setCurrentRequestPending(false);}
 }
 useEffect(()=>{currentActiveReference.current=true;return()=>{currentActiveReference.current=false;};},[]);
 return <section class="card" aria-label={translateCostumeText('wardrobe.title')}>
  <h2>{translateCostumeText('wardrobe.title')}</h2><p>{translateCostumeText('wardrobe.help')}</p>
  <button class="secondary" disabled={actionsAreDisabled||currentRequestPending||currentEquipUncertain} onClick={()=>void loadCostumeInventory()}>{translateCostumeText('wardrobe.refresh')}</button>
  {currentInventoryPage&&<button class="secondary" disabled={actionsAreDisabled||currentRequestPending||currentEquipUncertain||!costumeChangeAvailable()} onClick={()=>void equipSelectedCostume(currentInventoryPage.defaultCostumeId)}>{translateCostumeText('wardrobe.default')}</button>}
  {currentEquipUncertain&&<><p>{translateCostumeText('wardrobe.uncertain')}</p><button disabled={actionsAreDisabled||currentRequestPending||!costumeChangeAvailable()} onClick={()=>void equipSelectedCostume(currentEquipRequest.current!.costumeId)}>{translateCostumeText('wardrobe.retry')}</button></>}
  {!costumeChangeAvailable()&&<p>{translateCostumeText('wardrobe.unavailable')}</p>}
  {currentRequestPending&&<p role="status">{translateCostumeText('wardrobe.loading')}</p>}
  {currentInventoryNotice&&<p role="alert">{noticeText(currentInventoryNotice,currentCostumeLocale,translateCostumeText)}</p>}
  {currentInventoryPage?.entries.length===0&&<p>{translateCostumeText('wardrobe.empty')}</p>}
  {currentInventoryPage?.entries.map(currentOwnedEntry=><article key={currentOwnedEntry.costumeId}>
   <h3>{currentOwnedEntry.nameTranslations[currentCostumeLocale]}</h3>
   <p>{currentOwnedEntry.descriptionTranslations[currentCostumeLocale]}</p>
   <p>{translateCostumeText('wardrobe.value',{value:currentOwnedEntry.valueP})}</p>
   <button disabled={actionsAreDisabled||currentRequestPending||currentEquipUncertain||!costumeChangeAvailable()} onClick={()=>void equipSelectedCostume(currentOwnedEntry.costumeId)}>{translateCostumeText('wardrobe.equip')}</button>
   <p>{translateCostumeText(currentOwnedEntry.source==='shop'?'wardrobe.purchased':'wardrobe.received',{time:new Date(currentOwnedEntry.acquiredAt*1000).toLocaleString(currentCostumeLocale)})}</p>
  </article>)}
 </section>;
}
