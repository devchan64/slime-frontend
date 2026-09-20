import {useEffect,useRef,useState} from 'preact/hooks';
import type {State} from '../client/types';
import type {Client} from '../client/api';
import {parseScoutingObservation,type ScoutingObservation} from '../client/scouting';
import {fieldActionContext,canContinueFieldAction} from './fieldActionContext';
import {fieldDistance} from './fieldNavigation';
import {useTranslation} from '../i18n';

export function FieldScouting({currentGameState,currentTargetMonster,currentServerTime,currentActionsDisabled,currentGameClient,submitScoutCommand}:{
  currentGameState:State;currentTargetMonster:State['monsters'][number];currentServerTime:number;currentActionsDisabled:boolean;currentGameClient:Client;
  submitScoutCommand:(currentCommandPath:string,currentCommandBody:Record<string,unknown>,currentResultHandler:(currentCommandResult:any)=>void)=>unknown;
}) {
  const {t}=useTranslation();
  const [currentObservationResult,setCurrentObservationResult]=useState<ScoutingObservation|null>(null);
  const currentMountedReference=useRef(true);
  const currentPendingReference=useRef(false);
  useEffect(()=>()=>{currentMountedReference.current=false;},[]);
  useEffect(()=>{if(currentActionsDisabled)setCurrentObservationResult(null);},[currentActionsDisabled]);
  const currentScoutingPolicy=currentGameState.me.scouting;
  if(!currentScoutingPolicy)return null;
  const currentScoutingLevel=currentGameState.me.skillUseLocks?.scouting?0:currentGameState.me.skills.scouting??0;
  const currentLiteracyLevel=currentGameState.me.skillUseLocks?.literacy?0:currentGameState.me.skills.literacy??0;
  const currentAllowedDistance=[...currentScoutingPolicy.ranges].reverse().find(currentRangeEntry=>currentScoutingLevel>=currentRangeEntry.minimumLevel)?.tiles??0;
  const currentTargetDistance=fieldDistance(currentGameState.me.position,currentTargetMonster.position);
  const currentSafePosition=currentGameState.map.safeTown || fieldDistance(currentGameState.me.position,currentGameState.map.startPoint)<=currentGameState.map.safeRadius;
  const currentScoutingDisabled=currentActionsDisabled || currentGameState.me.mode!=='FIELD' || !!currentGameState.me.battleId
    || currentTargetMonster.state!=='AVAILABLE' || !!currentSafePosition || currentScoutingLevel<currentScoutingPolicy.minimumUseLevel
    || currentLiteracyLevel<currentScoutingPolicy.literacyRequired || currentTargetDistance>currentAllowedDistance
    || (currentGameState.me.fp??0)<currentScoutingPolicy.fpCost;
  const currentVisibleResult=currentObservationResult && currentObservationResult.expiresAt>currentServerTime && currentGameState.me.mode==='FIELD'
    && currentTargetMonster.state==='AVAILABLE' ? currentObservationResult:null;
  return <div class="field-scouting-controls"><button class="secondary compact" disabled={currentScoutingDisabled}
    title={t('field.scoutHelp',{range:currentAllowedDistance,cost:currentScoutingPolicy.fpCost})}
    onClick={()=>{
      if(currentPendingReference.current || currentScoutingDisabled)return;
      currentPendingReference.current=true;
      const currentRequestContext=fieldActionContext(currentGameState);
      const currentCommandPromise=submitScoutCommand('/v1/game/skills/scout',{monsterId:currentTargetMonster.id},currentCommandResult=>{
        if(!currentMountedReference.current || !canContinueFieldAction(currentRequestContext,currentGameClient.state))return;
        const currentParsedResult=parseScoutingObservation(currentCommandResult.scouting);
        if(currentParsedResult.mapId!==currentGameState.map.id || currentParsedResult.monsterId!==currentTargetMonster.id)throw new Error('정찰 요청과 결과 대상이 다릅니다.');
        setCurrentObservationResult(currentParsedResult);
      });
      void Promise.resolve(currentCommandPromise).finally(()=>{currentPendingReference.current=false;});
    }}>{t('field.scoutButton',{cost:currentScoutingPolicy.fpCost})}</button>
    {currentVisibleResult && <p role="status" aria-live="polite">{!currentVisibleResult.succeeded?t('field.scoutFailed'):
      currentVisibleResult.countBand!.maximumCount===null?t('field.scoutCountAtLeast',{minimum:currentVisibleResult.countBand!.minimumCount}):
      currentVisibleResult.countBand!.minimumCount===currentVisibleResult.countBand!.maximumCount?t('field.scoutCountExact',{count:currentVisibleResult.countBand!.minimumCount}):
      t('field.scoutCountRange',{minimum:currentVisibleResult.countBand!.minimumCount,maximum:currentVisibleResult.countBand!.maximumCount!})}
      {' · '}{t('field.scoutExpires',{seconds:Math.max(0,Math.ceil(currentVisibleResult.expiresAt-currentServerTime))})}</p>}
  </div>;
}
