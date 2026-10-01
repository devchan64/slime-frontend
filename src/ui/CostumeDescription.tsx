import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseCostumeCatalog,type CostumeCatalogEntry} from '../client/costumeCatalog';
import {LocalizedError,noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

const DEFAULT_PREVIEW_COSTUME_ID='default';
const DEFAULT_PREVIEW_DESIGN_ID='default';
const DEFAULT_PREVIEW_DESIGN_VERSION=1;

export function CostumeDescription({gameSessionClient}:{gameSessionClient:Client}){
 const {t:translateCostumeText,locale:currentCostumeLocale}=useTranslation();
 const [currentCostumeEntry,setCurrentCostumeEntry]=useState<CostumeCatalogEntry|null>(null);
 const [currentCostumeNotice,setCurrentCostumeNotice]=useState<Notice>('');
 const [costumeRequestPending,setCostumeRequestPending]=useState(false);
 const activeCostumeReference=useRef(false),pendingCostumeReference=useRef(false);
 const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,character:gameSessionClient.state?.me.id});
 function costumeSessionMatches(){return activeCostumeReference.current&&initialSessionReference.current.owner===gameSessionClient.tokens?.user_id&&initialSessionReference.current.generation===gameSessionClient.state?.generation&&initialSessionReference.current.character===gameSessionClient.state?.me.id;}
 async function loadCostumeDescription(){
  if(pendingCostumeReference.current||!costumeSessionMatches())return;
  pendingCostumeReference.current=true;setCostumeRequestPending(true);setCurrentCostumeNotice('');
  try{
   const currentCatalogPage=parseCostumeCatalog(await gameSessionClient.request('/v1/costumes'));
   const selectedCostumeEntry=currentCatalogPage.entries.find(currentCatalogEntry=>currentCatalogEntry.costumeId===currentCatalogPage.defaultCostumeId)!;
   // 현재 기본 미리보기와 같은 전체 디자인 정의만 연결한다.
   if(selectedCostumeEntry.costumeId!==DEFAULT_PREVIEW_COSTUME_ID||selectedCostumeEntry.designId!==DEFAULT_PREVIEW_DESIGN_ID||selectedCostumeEntry.designVersion!==DEFAULT_PREVIEW_DESIGN_VERSION)throw new LocalizedError('character.costumeUnsupported');
   if(costumeSessionMatches())setCurrentCostumeEntry(selectedCostumeEntry);
  }catch(currentRequestError){if(costumeSessionMatches())setCurrentCostumeNotice(currentRequestError as Error);}
  finally{pendingCostumeReference.current=false;if(costumeSessionMatches())setCostumeRequestPending(false);}
 }
 useEffect(()=>{activeCostumeReference.current=true;return()=>{activeCostumeReference.current=false;};},[]);
 return <details class="costume-description" onToggle={currentToggleEvent=>{if(currentToggleEvent.currentTarget.open&&!currentCostumeEntry&&!currentCostumeNotice)void loadCostumeDescription();}}>
  <summary><span class="costume-label">{currentCostumeEntry?.nameTranslations[currentCostumeLocale]??translateCostumeText('character.costume')}</span><span>{translateCostumeText('character.costumeDetails')}</span></summary>
  {costumeRequestPending&&<p role="status">{translateCostumeText('character.costumeLoading')}</p>}
  {currentCostumeNotice&&<div role="alert"><p>{noticeText(currentCostumeNotice,currentCostumeLocale,translateCostumeText)}</p><button class="secondary" disabled={costumeRequestPending} onClick={()=>void loadCostumeDescription()}>{translateCostumeText('journal.refresh')}</button></div>}
  {currentCostumeEntry&&<p>{currentCostumeEntry.descriptionTranslations[currentCostumeLocale]}</p>}
  <p class="costume-effect-note">{translateCostumeText('character.costumeAppearanceOnly')}</p>
 </details>;
}
