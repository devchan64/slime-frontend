import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {parseCityTaxResponse,type CityTaxPage} from '../client/city-tax-validation.mjs';
import {LocalizedError,noticeText,type Notice} from '../client/notice';
import {useTranslation} from '../i18n';

const CITY_TAX_DATE_OPTIONS:Intl.DateTimeFormatOptions={timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'};
export function CityTaxPanel({gameSessionClient}:{gameSessionClient:Client}){
 const {t:translateTaxText,locale:currentTaxLocale}=useTranslation();
 const [currentTaxPage,setCurrentTaxPage]=useState<CityTaxPage|null>(null);
 const [currentTaxNotice,setCurrentTaxNotice]=useState<Notice>('');
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const currentActiveReference=useRef(true);
 const currentPendingReference=useRef(false);
 const currentSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,character:gameSessionClient.state?.me.id});
 function matchesTaxSession(){
  return currentActiveReference.current&&currentSessionReference.current.owner===gameSessionClient.tokens?.user_id&&currentSessionReference.current.generation===gameSessionClient.state?.generation&&currentSessionReference.current.character===gameSessionClient.state?.me.id;
 }
 useEffect(()=>()=>{currentActiveReference.current=false;},[]);
 async function loadCurrentTaxes(){
  if(currentPendingReference.current||!matchesTaxSession())return;
  currentPendingReference.current=true;setCurrentRequestPending(true);setCurrentTaxNotice('');setCurrentTaxPage(null);
  try{
   const currentResponseValue=await gameSessionClient.request('/v1/economy/city-taxes');
   let currentValidatedPage:CityTaxPage;
   try{currentValidatedPage=parseCityTaxResponse(currentResponseValue);}catch{throw new LocalizedError('taxes.invalid');}
   if(matchesTaxSession())setCurrentTaxPage(currentValidatedPage);
  }catch(currentRequestError){if(matchesTaxSession())setCurrentTaxNotice(currentRequestError as Error);}
  finally{currentPendingReference.current=false;if(matchesTaxSession())setCurrentRequestPending(false);}
 }
 const currentDateFormatter=new Intl.DateTimeFormat(currentTaxLocale,CITY_TAX_DATE_OPTIONS);
 return <details class="city-tax-panel">
  <summary>{translateTaxText('taxes.title')}</summary>
  <p>{translateTaxText('taxes.description')}</p>
  <button class="secondary" disabled={currentRequestPending} onClick={()=>void loadCurrentTaxes()}>{translateTaxText(currentRequestPending?'taxes.loading':'taxes.refresh')}</button>
  {currentTaxNotice&&<p role="alert">{noticeText(currentTaxNotice,currentTaxLocale,translateTaxText)}</p>}
  {currentTaxPage&&<div aria-live="polite">
   <p>{translateTaxText('taxes.period',{start:currentDateFormatter.format(currentTaxPage.startsAt*1000),end:currentDateFormatter.format(currentTaxPage.expiresAt*1000)})}</p>
   <ul>{currentTaxPage.entries.map(currentCityEntry=><li key={currentCityEntry.cityId}>{currentCityEntry.cityName} [{currentCityEntry.cityId}]: {currentCityEntry.taxBasisPoints/100}% — {translateTaxText('taxes.count',{count:currentCityEntry.paidCitizenshipCount})}</li>)}</ul>
   <p>{translateTaxText('taxes.refreshRule')}</p>
  </div>}
 </details>;
}
