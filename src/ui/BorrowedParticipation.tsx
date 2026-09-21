import {useEffect,useState} from 'preact/hooks';
import type {Client} from '../client/api';
import type {State} from '../client/types';
import {BORROWED_EXCLUSION_LABELS,parseBorrowedParticipation,type BorrowedExclusion,type BorrowedParticipation as ParticipationResult} from '../client/borrowedParticipation';
import {useTranslation} from '../i18n';
import {fieldActionContext,canContinueFieldAction} from './fieldActionContext';

export function BorrowedExclusionNotice({currentExcludedEntries}:{currentExcludedEntries:BorrowedExclusion[]}) {
  const {t}=useTranslation();
  return currentExcludedEntries.length ? <div class="borrowed-participation" role="status"><strong>{t('battle.supportExcluded')}</strong>
    <ul>{currentExcludedEntries.map(currentExcludedEntry=><li key={currentExcludedEntry.loanId}>{currentExcludedEntry.name} · {t(BORROWED_EXCLUSION_LABELS[currentExcludedEntry.reason])}</li>)}</ul></div>:null;
}

export function BorrowedParticipationPreview({currentGameClient,currentGameState,currentActionsDisabled}:{currentGameClient:Client;currentGameState:State;currentActionsDisabled:boolean}) {
  const {t}=useTranslation();
  const [currentParticipationResult,setCurrentParticipationResult]=useState<ParticipationResult|null>(null);
  const [currentPreviewFailed,setCurrentPreviewFailed]=useState(false);
  const [currentRefreshVersion,setCurrentRefreshVersion]=useState(0);
  useEffect(()=>{
    let currentRequestCancelled=false;
    setCurrentParticipationResult(null);setCurrentPreviewFailed(false);
    if(currentActionsDisabled)return;
    const currentRequestContext=fieldActionContext(currentGameState);
    if(!canContinueFieldAction(currentRequestContext,currentGameClient.state))return;
    void currentGameClient.request('/v1/game/borrowed-party/participation').then(currentResponseValue=>{
      if(currentRequestCancelled || !canContinueFieldAction(currentRequestContext,currentGameClient.state))return;
      setCurrentParticipationResult(parseBorrowedParticipation(currentResponseValue));
    }).catch(()=>{if(!currentRequestCancelled&&canContinueFieldAction(currentRequestContext,currentGameClient.state))setCurrentPreviewFailed(true);});
    return ()=>{currentRequestCancelled=true;};
  },[currentGameClient,currentGameState.me.id,currentGameState.generation,currentGameState.epoch,
    currentGameState.location.id,currentGameState.me.lastFieldInterruption?.battleId,currentGameState.me.mode,
    currentGameState.me.version,currentActionsDisabled,currentRefreshVersion]);
  return <div class="borrowed-participation"><strong>{t('battle.supportPreview')}</strong>
    {currentParticipationResult && <><p>{[currentGameState.me.name,...currentParticipationResult.participants.map(currentParticipantEntry=>currentParticipantEntry.name)].join(' · ')}</p>
      <BorrowedExclusionNotice currentExcludedEntries={currentParticipationResult.excluded}/><small>{t('battle.supportRecheck')}</small></>}
    {currentPreviewFailed && <p role="alert">{t('battle.supportPreviewFailed')}</p>}
    <button class="secondary compact" disabled={currentActionsDisabled} onClick={()=>setCurrentRefreshVersion(currentCurrentVersion=>currentCurrentVersion+1)}>{t('battle.supportRefresh')}</button>
  </div>;
}
