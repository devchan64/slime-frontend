import {useEffect,useRef,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import {ApiError} from '../client/response';
import {noticeText,type Notice} from '../client/notice';
import {parsePartyCandidatePage,validatePartyFormationReceipt,type PartyCandidatePage,type PartyCandidateEntry} from '../client/partyFormation';
import {parseBorrowedLoanPage,type BorrowedLoanEntry} from '../client/borrowedLoans';
import {useTranslation} from '../i18n';

const PARTY_CANDIDATE_LABELS={AVAILABLE:'formation.available',ALREADY_BORROWED:'formation.borrowed',CP_OUT_OF_RANGE:'formation.cpBlocked',CAPACITY_FULL:'formation.full'};
type PendingFormationRequest={body:Record<string,unknown>;path:string;action:'ADD'|'REMOVE';loanId?:string};
export function PartyFormationPanel({gameSessionClient,currentFacilityIdentifier,actionsAreDisabled}:{gameSessionClient:Client;currentFacilityIdentifier:string;actionsAreDisabled:boolean}){
  const {t:translateFormationText,locale:currentFormationLocale}=useTranslation();
  const [currentCandidatePage,setCurrentCandidatePage]=useState<PartyCandidatePage|null>(null);
  const [currentBorrowedEntries,setCurrentBorrowedEntries]=useState<BorrowedLoanEntry[]>([]);
  const [currentSelectedCandidate,setCurrentSelectedCandidate]=useState<PartyCandidateEntry|null>(null);
  const [currentFormationNotice,setCurrentFormationNotice]=useState<Notice>('');
  const [currentRequestPending,setCurrentRequestPending]=useState(false);
  const [currentFormationUncertain,setCurrentFormationUncertain]=useState(false);
  const activePanelReference=useRef(false),pendingRequestReference=useRef(false);
  const originalCommandReference=useRef<PendingFormationRequest|null>(null);
  const originalSessionReference=useRef({owner:gameSessionClient.tokens?.user_id,generation:gameSessionClient.state?.generation,character:gameSessionClient.state?.me.id,
    map:gameSessionClient.state?.map.id,position:JSON.stringify(gameSessionClient.state?.me.position)});
  function formationSessionMatches(){return activePanelReference.current&&gameSessionClient.tokens?.user_id===originalSessionReference.current.owner
    &&gameSessionClient.state?.generation===originalSessionReference.current.generation&&gameSessionClient.state?.me.id===originalSessionReference.current.character
    &&gameSessionClient.state?.map.id===originalSessionReference.current.map&&gameSessionClient.state?.me.mode==='FIELD'
    &&JSON.stringify(gameSessionClient.state?.me.position)===originalSessionReference.current.position;}
  async function runFormationRequest(currentRequestAction:()=>Promise<void>){
    if(actionsAreDisabled||pendingRequestReference.current||!formationSessionMatches())return;
    pendingRequestReference.current=true;setCurrentRequestPending(true);setCurrentFormationNotice('');
    try{await currentRequestAction();}catch(currentRequestError){if(formationSessionMatches())setCurrentFormationNotice(currentRequestError as Error);}
    finally{pendingRequestReference.current=false;if(formationSessionMatches())setCurrentRequestPending(false);}
  }
  async function loadFormationContents(currentPageCursor?:string){
    const currentReceivedPage=parsePartyCandidatePage(await gameSessionClient.request(`/v1/game/guilds/${encodeURIComponent(currentFacilityIdentifier)}/party-candidates${currentPageCursor?'?after='+encodeURIComponent(currentPageCursor):''}`),originalSessionReference.current.map!);
    const currentLoanEntries:BorrowedLoanEntry[]=[];let currentLoanCursor:string|null=null;
    const currentVisitedCursors=new Set<string>();
    do{
      const currentLoanPage=parseBorrowedLoanPage(await gameSessionClient.request('/v1/game/loans'+(currentLoanCursor?'?after='+encodeURIComponent(currentLoanCursor):'')));
      currentLoanEntries.push(...currentLoanPage.entries);currentLoanCursor=currentLoanPage.nextCursor;
      if(currentLoanCursor&&currentVisitedCursors.has(currentLoanCursor))throw new Error('대여 목록 페이지가 반복되었습니다.');
      if(currentLoanCursor)currentVisitedCursors.add(currentLoanCursor);
    }while(currentLoanCursor&&formationSessionMatches());
    if(formationSessionMatches()){setCurrentCandidatePage(currentReceivedPage);setCurrentBorrowedEntries(currentLoanEntries);setCurrentSelectedCandidate(null);}
  }
  async function submitFormationChange(currentRequestedCommand?:PendingFormationRequest){await runFormationRequest(async()=>{
    if(currentRequestedCommand)originalCommandReference.current=currentRequestedCommand;
    const currentOriginalCommand=originalCommandReference.current;if(!currentOriginalCommand)return;
    let currentReceiptConfirmed=false;
    if(currentFormationUncertain){
      try{
        const currentStoredReceipt=await gameSessionClient.request('/v1/game/borrowed-party-results/'+currentOriginalCommand.body.requestId);
        validatePartyFormationReceipt(currentStoredReceipt,String(currentOriginalCommand.body.requestId),currentOriginalCommand.action,currentOriginalCommand.loanId);currentReceiptConfirmed=true;
      }catch(currentRecoveryError){if(!(currentRecoveryError instanceof ApiError&&currentRecoveryError.status===404&&currentRecoveryError.code==='PARTY_FORMATION_NOT_FOUND'))throw currentRecoveryError;}
      if(!formationSessionMatches())return;
    }
    if(!currentReceiptConfirmed){
      try{
        const currentCommandResponse=await gameSessionClient.request(currentOriginalCommand.path,currentOriginalCommand.body);
        validatePartyFormationReceipt(currentCommandResponse.receipt,String(currentOriginalCommand.body.requestId),currentOriginalCommand.action,currentOriginalCommand.loanId);
        if(!formationSessionMatches())return;
        gameSessionClient.accept(currentCommandResponse.state);
      }catch(currentCommandError){if(formationSessionMatches())setCurrentFormationUncertain(!(currentCommandError instanceof ApiError)||currentCommandError.status>=500);throw currentCommandError;}
    }else{
      const currentLatestState=await gameSessionClient.request('/v1/game/state');if(!formationSessionMatches())return;gameSessionClient.accept(currentLatestState);
    }
    if(!formationSessionMatches())return;
    setCurrentFormationUncertain(false);originalCommandReference.current=null;
    await loadFormationContents();
    if(formationSessionMatches())setCurrentFormationNotice({key:'formation.saved'});
  });}
  useEffect(()=>{activePanelReference.current=true;return()=>{activePanelReference.current=false;};},[]);
  const currentSelectedLoanIds=gameSessionClient.state?.me.borrowedPartyLoanIds??[];
  const currentSelectedMembers=currentBorrowedEntries.filter(currentLoanEntry=>currentSelectedLoanIds.includes(currentLoanEntry.id));
  const currentControlsDisabled=actionsAreDisabled||currentRequestPending||currentFormationUncertain;
  return <section class="guild-trade-panel">
    <button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void runFormationRequest(()=>loadFormationContents())}>{translateFormationText('formation.title')}</button>
    {currentCandidatePage&&<div>
      <p>{translateFormationText('formation.count',{count:currentSelectedMembers.filter(currentLoanEntry=>!currentLoanEntry.expired).length+1})}</p>
      <p>{translateFormationText('formation.help')}</p>
      <ul class="bag-items">{currentSelectedMembers.map(currentLoanEntry=><li key={currentLoanEntry.id}><strong>{currentLoanEntry.name}</strong>
        <button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void submitFormationChange({action:'REMOVE',loanId:currentLoanEntry.id,
          path:`/v1/game/borrowed-party/${encodeURIComponent(currentLoanEntry.id)}/remove`,body:{requestId:crypto.randomUUID(),expectedVersion:gameSessionClient.state!.me.version}})}>{translateFormationText('formation.remove')}</button></li>)}</ul>
      {!currentCandidatePage.entries.length&&<p>{translateFormationText('formation.empty')}</p>}
      <ul class="bag-items">{currentCandidatePage.entries.map(currentCandidateEntry=>{
        const currentAlreadySelected=currentSelectedMembers.some(currentLoanEntry=>!currentLoanEntry.expired&&currentLoanEntry.sourceCharacterId===currentCandidateEntry.characterId);
        return <li key={currentCandidateEntry.characterId}><strong>{currentCandidateEntry.name}</strong><p>{translateFormationText(currentAlreadySelected?'formation.selected':PARTY_CANDIDATE_LABELS[currentCandidateEntry.status])}</p>
          <button class="secondary compact" disabled={currentControlsDisabled||currentAlreadySelected||!['AVAILABLE','ALREADY_BORROWED'].includes(currentCandidateEntry.status)||currentSelectedMembers.filter(currentLoanEntry=>!currentLoanEntry.expired).length>=3}
            onClick={()=>setCurrentSelectedCandidate(currentCandidateEntry)}>{translateFormationText('formation.choose')}</button></li>;
      })}</ul>
      {currentSelectedCandidate&&<div class="guild-sale-quote"><strong>{translateFormationText('formation.confirmName',{name:currentSelectedCandidate.name})}</strong>
        <button class="compact" disabled={currentControlsDisabled} onClick={()=>void submitFormationChange({action:'ADD',path:`/v1/game/guilds/${encodeURIComponent(currentFacilityIdentifier)}/party-members`,
          body:{requestId:crypto.randomUUID(),expectedVersion:gameSessionClient.state!.me.version,characterId:currentSelectedCandidate.characterId}})}>{translateFormationText('formation.add')}</button></div>}
      {currentCandidatePage.nextCursor&&<button class="secondary compact" disabled={currentControlsDisabled} onClick={()=>void runFormationRequest(()=>loadFormationContents(currentCandidatePage.nextCursor!))}>{translateFormationText('formation.next')}</button>}
    </div>}
    {currentFormationUncertain&&<button class="compact" disabled={actionsAreDisabled||currentRequestPending} onClick={()=>void submitFormationChange()}>{translateFormationText('formation.recover')}</button>}
    {currentRequestPending&&<p role="status">{translateFormationText('formation.pending')}</p>}
    {currentFormationNotice&&<p role="status">{noticeText(currentFormationNotice,currentFormationLocale,translateFormationText)}</p>}
  </section>;
}
