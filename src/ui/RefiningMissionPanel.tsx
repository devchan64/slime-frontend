import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {validateMissionPage,validateMissionCancellation,type RefiningMissionPage,type RefiningMissionRecord} from '../client/refining-mission-validation.mjs';
import {useTranslation} from '../i18n';

type MissionCancellationRequest={record:RefiningMissionRecord;payload:{expectedVersion:number}};
export function RefiningMissionPanel({gameSessionClient,actionsAreDisabled,characterStateVersion}:{gameSessionClient:Client;actionsAreDisabled:boolean;characterStateVersion:number}){
 const {t:translateMissionText,locale:currentLocaleCode}=useTranslation();
 const [currentMissionPage,setCurrentMissionPage]=useState<RefiningMissionPage|null>(null);
 const [currentSelectedMission,setCurrentSelectedMission]=useState<RefiningMissionRecord|null>(null);
 const [currentUncertainRequest,setCurrentUncertainRequest]=useState<MissionCancellationRequest|null>(null);
 const [currentRequestPending,setCurrentRequestPending]=useState(false);
 const [currentMissionNotice,setCurrentMissionNotice]=useState<Notice>('');
 const currentMountedReference=useRef(false),currentBusyReference=useRef(false);
 const currentSessionIdentity=useRef({owner:gameSessionClient.tokens?.user_id,character:gameSessionClient.state?.me.id,generation:gameSessionClient.state?.generation,epoch:gameSessionClient.state?.epoch});
 function missionSessionMatches(){return currentMountedReference.current&&currentSessionIdentity.current.owner===gameSessionClient.tokens?.user_id&&currentSessionIdentity.current.character===gameSessionClient.state?.me.id&&currentSessionIdentity.current.generation===gameSessionClient.state?.generation&&currentSessionIdentity.current.epoch===gameSessionClient.state?.epoch;}
 async function loadMissionRecords(currentPageOffset=0){
  if(currentBusyReference.current||!missionSessionMatches())return;
  currentBusyReference.current=true;setCurrentRequestPending(true);setCurrentMissionNotice('');setCurrentSelectedMission(null);
  try{
   const currentReceivedPage=validateMissionPage(await gameSessionClient.request('/v1/game/refining-missions?offset='+currentPageOffset),currentSessionIdentity.current.character!,currentPageOffset);
   if(!missionSessionMatches())return;
   if(currentReceivedPage.characterVersion!==gameSessionClient.state?.me.version)throw new Error(translateMissionText('missions.changed'));
   setCurrentMissionPage(currentReceivedPage);
  }catch(currentRequestError){if(missionSessionMatches())setCurrentMissionNotice(currentRequestError as Error);}
  finally{currentBusyReference.current=false;if(missionSessionMatches())setCurrentRequestPending(false);}
 }
 useEffect(()=>{currentMountedReference.current=true;void loadMissionRecords();return()=>{currentMountedReference.current=false;};},[]);
 async function cancelMissionRecord(currentCancellationRequest:MissionCancellationRequest){
  if(currentBusyReference.current||actionsAreDisabled||!missionSessionMatches())return;
  currentBusyReference.current=true;setCurrentRequestPending(true);setCurrentMissionNotice('');
  try{
   const currentResponseRecord=await gameSessionClient.request('/v1/game/refining-missions/'+currentCancellationRequest.record.requestId+'/cancel',currentCancellationRequest.payload);
   if(!missionSessionMatches())return;
   validateMissionCancellation(currentResponseRecord.receipt,currentCancellationRequest.record,currentSessionIdentity.current.character!);
   if(currentResponseRecord.state?.me.id!==currentSessionIdentity.current.character||currentResponseRecord.state?.generation!==currentSessionIdentity.current.generation||currentResponseRecord.state?.epoch!==currentSessionIdentity.current.epoch||!Number.isSafeInteger(currentResponseRecord.state?.me.version)||currentResponseRecord.state.me.version<=currentCancellationRequest.payload.expectedVersion)throw new Error(translateMissionText('missions.invalidReceipt'));
   gameSessionClient.accept(currentResponseRecord.state);
   setCurrentMissionPage(null);setCurrentSelectedMission(null);setCurrentUncertainRequest(null);setCurrentMissionNotice({key:'missions.cancelled'});
  }catch(currentRequestError){
   if(missionSessionMatches()){
    setCurrentMissionNotice(currentRequestError as Error);
    if(!(currentRequestError instanceof ApiError)||currentRequestError.status>=500)setCurrentUncertainRequest(currentCancellationRequest);
    else{setCurrentUncertainRequest(null);setCurrentSelectedMission(null);}
   }
  }finally{currentBusyReference.current=false;if(missionSessionMatches())setCurrentRequestPending(false);}
 }
 function renderMissionSummary(currentMissionRecord:RefiningMissionRecord){
  const currentDestinationEntry=currentMissionPage?.destinations?.[currentMissionRecord.requestId];
  return <>
   <p>{translateMissionText('missions.output',{item:currentLocaleCode==='en'?currentMissionRecord.quote.refining.outputMaterial.englishName:currentMissionRecord.quote.refining.outputMaterial.name,grade:translateMissionText('missions.'+currentMissionRecord.quote.refining.grade),count:currentMissionRecord.quote.refining.outputQuantity})}</p>
   {currentDestinationEntry&&<p>{translateMissionText('missions.destination',{city:currentDestinationEntry.refiningCityNameTranslations[currentLocaleCode],receiverCity:currentDestinationEntry.receiverCityNameTranslations[currentLocaleCode],npc:currentDestinationEntry.receiverName})}</p>}
   <p>{translateMissionText('missions.acceptedAt',{time:new Date(currentMissionRecord.acceptedAt*1000).toLocaleString(currentLocaleCode==='ko'?'ko-KR':'en-US')})}</p>
  </>;
 }
 const currentPageStale=!!currentMissionPage&&currentMissionPage.characterVersion!==characterStateVersion;
 const currentActionsLocked=actionsAreDisabled||currentRequestPending||!!currentUncertainRequest||currentPageStale||gameSessionClient.state?.me.mode!=='FIELD'||!!gameSessionClient.state?.battle||!!gameSessionClient.state?.reservation;
 return <section class="card" aria-label={translateMissionText('missions.title')}>
  <h3>{translateMissionText('missions.title')}</h3><p>{translateMissionText('missions.noRefund')}</p>
  <button class="secondary" disabled={actionsAreDisabled||currentRequestPending||!!currentUncertainRequest} onClick={()=>void loadMissionRecords()}>{translateMissionText('missions.refresh')}</button>
  {currentRequestPending&&<p role="status">{translateMissionText('missions.loading')}</p>}
  {currentMissionNotice&&<p role="status">{noticeText(currentMissionNotice,currentLocaleCode,translateMissionText)}</p>}
  {currentPageStale&&<p>{translateMissionText('missions.changed')}</p>}
  {currentUncertainRequest&&<><p>{translateMissionText('missions.uncertain')}</p><button disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void cancelMissionRecord(currentUncertainRequest)}>{translateMissionText('missions.retry')}</button></>}
  {currentMissionPage?.entries.length===0&&<p>{translateMissionText('missions.empty')}</p>}
  <ul class="bag-items">{currentMissionPage?.entries.map(currentMissionRecord=><li key={currentMissionRecord.requestId}>
   <strong>{translateMissionText('missions.record')} · {translateMissionText('missions.status'+currentMissionRecord.status[0]+currentMissionRecord.status.slice(1).toLowerCase())}</strong>
   {renderMissionSummary(currentMissionRecord)}
   <p>{translateMissionText('missions.processing',{count:currentMissionRecord.quote.refining.inputQuantity,seconds:currentMissionRecord.quote.refining.durationSeconds})}</p>
   <p>{translateMissionText('missions.payment',{deposit:currentMissionRecord.quote.deposit.depositP,cost:currentMissionRecord.quote.refining.costP,reward:currentMissionRecord.quote.rewardP})}</p>
   {currentMissionRecord.status==='ACTIVE'&&<button disabled={currentActionsLocked} onClick={()=>setCurrentSelectedMission(currentMissionRecord)}>{translateMissionText('missions.cancel')}</button>}
  </li>)}</ul>
  {currentMissionPage?.nextOffset!=null&&<button disabled={actionsAreDisabled||currentRequestPending||!!currentUncertainRequest} onClick={()=>void loadMissionRecords(currentMissionPage.nextOffset!)}>{translateMissionText('missions.next')}</button>}
  {currentSelectedMission&&!currentUncertainRequest&&<div role="group" aria-label={translateMissionText('missions.confirmTitle')}>{renderMissionSummary(currentSelectedMission)}<p>{translateMissionText('missions.noRefund')}</p>
   <button disabled={currentActionsLocked} onClick={()=>void cancelMissionRecord({record:currentSelectedMission,payload:{expectedVersion:currentMissionPage!.characterVersion}})}>{translateMissionText('missions.confirm')}</button>
   <button class="secondary" disabled={currentRequestPending} onClick={()=>setCurrentSelectedMission(null)}>{translateMissionText('missions.keep')}</button></div>}
 </section>;
}
