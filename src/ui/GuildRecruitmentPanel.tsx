import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {parseGuildRecruitmentPage,validateGuildRegistrationResult,type GuildRecruitmentPage} from '../client/guildRecruitment';
import {useTranslation} from '../i18n';

export function GuildRecruitmentPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
  const {t:translateRecruitmentText,locale:currentRecruitmentLocale}=useTranslation();
  const [currentRegistrationPage,setCurrentRegistrationPage]=useState<GuildRecruitmentPage|null>(null);
  const [currentRecruitmentNotice,setCurrentRecruitmentNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const [currentResultUncertain,setCurrentResultUncertain]=useState(false);
  const activePanelReference=useRef(false);
  const pendingRequestReference=useRef(false);
  const initialSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,
    character:gameSessionClient.state?.me.id,map:gameSessionClient.state?.map.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
  function recruitmentSessionMatches(){return activePanelReference.current&&gameSessionClient.tokens?.user_id===initialSessionReference.current.owner
    &&gameSessionClient.state?.generation===initialSessionReference.current.generation&&gameSessionClient.state?.me.id===initialSessionReference.current.character
    &&gameSessionClient.state?.map.id===initialSessionReference.current.map&&gameSessionClient.state?.me.mode==='FIELD'
    &&JSON.stringify(gameSessionClient.state?.me.position)===initialSessionReference.current.position;}
  async function runRecruitmentRequest(currentRequestAction:()=>Promise<void>){
    if(actionsAreDisabled||pendingRequestReference.current||!recruitmentSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentRecruitmentNotice('');
    try{await currentRequestAction();}catch(currentRequestError){if(recruitmentSessionMatches())setCurrentRecruitmentNotice(currentRequestError as Error);}
    finally{pendingRequestReference.current=false;if(recruitmentSessionMatches())setCurrentRequestPending(false);}
  }
  async function loadRecruitmentStatus(){await runRecruitmentRequest(async()=>{
    const currentReceivedPage=parseGuildRecruitmentPage(await gameSessionClient.request('/v1/game/guild-recruitments'));
    if(recruitmentSessionMatches()){setCurrentRegistrationPage(currentReceivedPage);setCurrentResultUncertain(false);}
  });}
  async function changeRecruitmentStatus(){await runRecruitmentRequest(async()=>{
    if(!currentRegistrationPage||currentResultUncertain)return;
    const currentRegistrationEnabled=!currentRegistrationPage.entries.some(currentRegistrationEntry=>currentRegistrationEntry.cityId===initialSessionReference.current.map);
    try{
      const currentChangeResponse=await gameSessionClient.request(`/v1/game/guilds/${encodeURIComponent(currentFacilityIdentifier)}/registration`,
        {registered:currentRegistrationEnabled,expectedVersion:currentRegistrationPage.characterVersion});
      validateGuildRegistrationResult(currentChangeResponse,initialSessionReference.current.map!,currentRegistrationEnabled);
      if(!recruitmentSessionMatches())return;
      // 변경 응답만으로 목록을 합성하지 않고 확정된 현재 등록을 조회한다.
      const currentReceivedPage=parseGuildRecruitmentPage(await gameSessionClient.request('/v1/game/guild-recruitments'));
      if(recruitmentSessionMatches()){setCurrentRegistrationPage(currentReceivedPage);setCurrentResultUncertain(false);}
    }catch(currentChangeError){
      if(recruitmentSessionMatches()){
        setCurrentResultUncertain(!(currentChangeError instanceof ApiError)||currentChangeError.status>=500);
        setCurrentRegistrationPage(null);
      }
      throw currentChangeError;
    }
  });}
  useEffect(()=>{activePanelReference.current=true;return()=>{activePanelReference.current=false;};},[]);
  const currentRegistrationEnabled=currentRegistrationPage?.entries.some(currentRegistrationEntry=>currentRegistrationEntry.cityId===initialSessionReference.current.map)??false;
  return <section class="guild-trade-panel">
    <button class="secondary compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void loadRecruitmentStatus()}>{translateRecruitmentText('guild.registrationStatus')}</button>
    {currentRegistrationPage&&<div>
      <p>{translateRecruitmentText(currentRegistrationEnabled?'guild.registered':'guild.unregistered')}</p>
      <p>{translateRecruitmentText('guild.registrationHelp')}</p>
      <button class="compact" disabled={actionsAreDisabled||currentRequestPending||currentResultUncertain} onClick={()=>void changeRecruitmentStatus()}>{translateRecruitmentText(currentRegistrationEnabled?'guild.unregister':'guild.register')}</button>
    </div>}
    {currentResultUncertain&&<p role="status">{translateRecruitmentText('guild.registrationUncertain')}</p>}
    {currentRequestPending&&<p role="status">{translateRecruitmentText('guild.pending')}</p>}
    {currentRecruitmentNotice&&<p role="status">{noticeText(currentRecruitmentNotice,currentRecruitmentLocale,translateRecruitmentText)}</p>}
  </section>;
}
