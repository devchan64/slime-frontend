import {useEffect,useRef,useState} from 'preact/hooks';
import type {State,Position} from '../client/types';
import type {Client} from '../client/api';
import {useTranslation} from '../i18n';
import {fieldActionContext,canContinueFieldAction} from './fieldActionContext';
import {validateExplorationResult} from '../client/exploration-result.mjs';
export function FieldExploration({currentGameState,currentTargetPosition,currentGameClient,currentActionsDisabled,submitExplorationCommand}:{
 currentGameState:State;currentTargetPosition:Position;currentGameClient:Client;currentActionsDisabled:boolean;
 submitExplorationCommand:(currentPath:string,currentBody:Record<string,unknown>,currentResultHandler:(currentResult:any)=>void)=>unknown;
}){
 const {t:translateExplorationText}=useTranslation();
 const [currentResultMessage,setCurrentResultMessage]=useState('');
 const currentPendingReference=useRef(false),currentMountedReference=useRef(true);
 useEffect(()=>()=>{currentMountedReference.current=false;},[]);
 const currentPolicyRecord=currentGameState.me.exploration;
 if(!currentPolicyRecord)return null;
 const currentTargetDistance=Math.abs(currentGameState.me.position.column-currentTargetPosition.column)+Math.abs(currentGameState.me.position.row-currentTargetPosition.row);
 return <div class="field-exploration"><p>{translateExplorationText('field.exploreHelp',{cost:currentPolicyRecord.fpCost})}</p>
 {(['mineral','treasure'] as const).map(currentResourceKind=>{
  const currentOptionRecord=currentPolicyRecord.options[currentResourceKind];
  const currentSkillUnavailable=currentOptionRecord.range===0||(currentGameState.me.skills?.literacy??0)<currentPolicyRecord.literacyRequired;
  const currentButtonDisabled=currentActionsDisabled||currentGameState.me.mode!=='FIELD'||Boolean(currentGameState.reservation)||Boolean(currentGameState.battle)||currentSkillUnavailable||currentTargetDistance>currentOptionRecord.range||(currentGameState.me.fp??0)<currentPolicyRecord.fpCost;
  return <button disabled={currentButtonDisabled} title={translateExplorationText('field.exploreRequirements',{range:currentOptionRecord.range,chance:currentOptionRecord.successPercent})} onClick={()=>{
   if(currentPendingReference.current)return;
   currentPendingReference.current=true;setCurrentResultMessage('');
   const currentCommandContext=fieldActionContext(currentGameState);
   const currentCommandPromise=submitExplorationCommand('/v1/game/skills/explore',{position:currentTargetPosition,resourceKind:currentResourceKind},currentCommandResult=>{
    if(!currentMountedReference.current||!canContinueFieldAction(currentCommandContext,currentGameClient.state))return;
    const currentExplorationResult=validateExplorationResult(currentCommandResult.exploration,currentGameState.map.id,currentResourceKind,currentTargetPosition);
    setCurrentResultMessage(translateExplorationText(currentExplorationResult.succeeded?'field.exploreSuccess':'field.exploreFailure'));
   });
   void Promise.resolve(currentCommandPromise).finally(()=>{currentPendingReference.current=false;});
  }}>{translateExplorationText('field.explore'+(currentResourceKind==='mineral'?'Mineral':'Treasure'))}</button>;
 })}
 {currentResultMessage&&<p role="status">{currentResultMessage}</p>}
 </div>;
}
