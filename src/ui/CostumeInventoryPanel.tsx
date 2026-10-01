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
 const currentActiveReference=useRef(false),currentPendingReference=useRef(false);
 const currentSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation});
 function costumeInventorySessionMatches(){return currentActiveReference.current&&gameSessionClient.tokens?.user_id===currentSessionReference.current.owner&&gameSessionClient.state?.me.id===currentSessionReference.current.character&&gameSessionClient.state?.generation===currentSessionReference.current.generation;}
 async function loadCostumeInventory(){
  if(actionsAreDisabled||currentPendingReference.current||!costumeInventorySessionMatches())return;
  currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentInventoryNotice('');setCurrentInventoryPage(null);
  try{
   const currentResponseRecord=parseCostumeInventory(await gameSessionClient.request('/v1/characters/me/costumes'));
   if(costumeInventorySessionMatches())setCurrentInventoryPage(currentResponseRecord);
  }catch(currentRequestError){if(costumeInventorySessionMatches())setCurrentInventoryNotice(currentRequestError as Error);}
  finally{currentPendingReference.current=false;if(costumeInventorySessionMatches())setCurrentRequestPending(false);}
 }
 useEffect(()=>{currentActiveReference.current=true;return()=>{currentActiveReference.current=false;};},[]);
 return <section class="card" aria-label={translateCostumeText('wardrobe.title')}>
  <h2>{translateCostumeText('wardrobe.title')}</h2><p>{translateCostumeText('wardrobe.help')}</p>
  <button class="secondary" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void loadCostumeInventory()}>{translateCostumeText('wardrobe.refresh')}</button>
  {currentRequestPending&&<p role="status">{translateCostumeText('wardrobe.loading')}</p>}
  {currentInventoryNotice&&<p role="alert">{noticeText(currentInventoryNotice,currentCostumeLocale,translateCostumeText)}</p>}
  {currentInventoryPage?.entries.length===0&&<p>{translateCostumeText('wardrobe.empty')}</p>}
  {currentInventoryPage?.entries.map(currentOwnedEntry=><article key={currentOwnedEntry.costumeId}>
   <h3>{currentOwnedEntry.nameTranslations[currentCostumeLocale]}</h3>
   <p>{currentOwnedEntry.descriptionTranslations[currentCostumeLocale]}</p>
   <p>{translateCostumeText('wardrobe.value',{value:currentOwnedEntry.valueP})}</p>
   <p>{translateCostumeText('wardrobe.received',{time:new Date(currentOwnedEntry.acquiredAt*1000).toLocaleString(currentCostumeLocale)})}</p>
  </article>)}
 </section>;
}
