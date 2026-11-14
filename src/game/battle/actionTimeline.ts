import type {Battle, Unit} from '../../client/types';

export type BattleActionEntry = {executionIdentifier:string; actorSnapshot:Unit; targetSnapshot:Unit; resultRecord:Battle['log'][number]; playbackSpeedMultiplier?:number};
export const ACTION_QUEUE_CAPACITY = 64;
const AUTOMATIC_PRESENTATION_SPEED_MULTIPLIER = 2;
/** 누적 로그의 위치는 전투 내 불변 실행 식별자다. 최초 스냅샷은 기준점으로만 사용한다. */
export class BattleActionTimeline {
  private currentBattleIdentity = '';
  private previousLogRecords:Battle['log'] = [];
  private observedExecutionIdentifiers=new Set<string>();
  private previousUnitRecords = new Map<string,Unit>();
  readonly pendingActionEntries:BattleActionEntry[] = [];
  synchronizeActionResults(currentBattleState:Battle|null,currentSessionIdentity:string,currentPresentationEnabled:boolean){
    if(!currentBattleState){this.clearActionTimeline();return;}
    const currentBattleIdentity=`${currentSessionIdentity}:${currentBattleState.id}`;
    if(currentBattleIdentity!==this.currentBattleIdentity || currentBattleState.log.length<this.previousLogRecords.length){
      this.clearActionTimeline();this.currentBattleIdentity=currentBattleIdentity;
      this.previousLogRecords=currentBattleState.log.slice();
      for(const currentInitialResult of currentBattleState.log)if(currentInitialResult.executionId)this.observedExecutionIdentifiers.add(currentInitialResult.executionId);
    }
    const currentUnitRecords=new Map(currentBattleState.units.map(currentUnitRecord=>[currentUnitRecord.id,currentUnitRecord]));
    for(let currentLogIndex=this.previousLogRecords.length;currentLogIndex<currentBattleState.log.length;currentLogIndex++){
      const currentResultRecord=currentBattleState.log[currentLogIndex];
      if(!['ATTACK','SKILL'].includes(currentResultRecord.action) || !currentResultRecord.targetId)continue;
      if(currentResultRecord.executionId){
        if(this.observedExecutionIdentifiers.has(currentResultRecord.executionId))continue;
        this.observedExecutionIdentifiers.add(currentResultRecord.executionId);
      }
      if(!currentPresentationEnabled)continue;
      const currentActorSnapshot=this.previousUnitRecords.get(currentResultRecord.unitId)??currentUnitRecords.get(currentResultRecord.unitId);
      const currentTargetSnapshot=this.previousUnitRecords.get(currentResultRecord.targetId)??currentUnitRecords.get(currentResultRecord.targetId);
      if(!currentActorSnapshot||!currentTargetSnapshot)throw Error('전투 액션의 행동자 또는 대상이 없습니다.');
      if(this.pendingActionEntries.length>=ACTION_QUEUE_CAPACITY)throw Error('전투 액션 연출 대기열 한도를 초과했습니다.');
      this.pendingActionEntries.push({executionIdentifier:currentResultRecord.executionId?`${currentSessionIdentity}:${currentResultRecord.executionId}`:`${currentBattleIdentity}:${currentLogIndex}`,actorSnapshot:{...currentActorSnapshot},targetSnapshot:{...currentTargetSnapshot},resultRecord:currentResultRecord,playbackSpeedMultiplier:currentBattleState.units.some(currentUnitRecord=>currentUnitRecord.side==='ally'&&currentUnitRecord.automaticPlay===true)?AUTOMATIC_PRESENTATION_SPEED_MULTIPLIER:1});
    }
    this.previousLogRecords=currentBattleState.log.slice();this.previousUnitRecords=currentUnitRecords;
    if(!currentPresentationEnabled)this.pendingActionEntries.length=0;
  }
  clearActionTimeline(){this.observedExecutionIdentifiers.clear();this.currentBattleIdentity='';this.previousLogRecords=[];this.previousUnitRecords.clear();this.pendingActionEntries.length=0;}
}

/** 마지막 프레임 진입을 기본값으로 사용한다. 명시된 복수 마커는 원래 순서 그대로 검증한다. */
export function resolveActionHitTimes(currentFrameDurations:number[],currentHitTimes?:number[]):number[]{
  if(!currentFrameDurations.length||currentFrameDurations.some(currentDurationValue=>!Number.isFinite(currentDurationValue)||currentDurationValue<=0))throw Error('타격 클립의 프레임 길이가 올바르지 않습니다.');
  const currentClipDuration=currentFrameDurations.reduce((currentTotalDuration,currentFrameDuration)=>currentTotalDuration+currentFrameDuration,0);
  if(!currentHitTimes?.length)return [currentClipDuration-currentFrameDurations[currentFrameDurations.length-1]];
  if(currentHitTimes.some((currentHitTime,currentHitIndex)=>!Number.isFinite(currentHitTime)||currentHitTime<0||currentHitTime>=currentClipDuration||(currentHitIndex>0&&currentHitTime<currentHitTimes[currentHitIndex-1])))throw Error('타격 시점의 범위 또는 순서가 올바르지 않습니다.');
  return currentHitTimes.slice();
}
export function collectCrossedHitIndices(currentHitTimes:number[],previousElapsedTime:number,currentElapsedTime:number){
  return currentHitTimes.flatMap((currentHitTime,currentHitIndex)=>currentHitTime>previousElapsedTime&&currentHitTime<=currentElapsedTime?[currentHitIndex]:[]);
}
export type SpriteHitGeometry={anchorX:number;anchorY:number;hitX:number;hitY:number;width:number;height:number;minimumX?:number;maximumX?:number;minimumY?:number};
/** 피격점은 프레임 내부 픽셀에서 앵커를 빼고 대상의 실제 배율·반전·회전을 적용한다. */
export function transformSpriteHitPoint(currentFrameGeometry:SpriteHitGeometry,currentActorTransform:{x:number;y:number;scale:number;rotation:number;flipped:boolean}){
  const currentLocalOffsetX=(currentFrameGeometry.hitX-currentFrameGeometry.anchorX)*currentActorTransform.scale*(currentActorTransform.flipped?-1:1);
  const currentLocalOffsetY=(currentFrameGeometry.hitY-currentFrameGeometry.anchorY)*currentActorTransform.scale;
  const currentRotationCosine=Math.cos(currentActorTransform.rotation),currentRotationSine=Math.sin(currentActorTransform.rotation);
  return {x:currentActorTransform.x+currentLocalOffsetX*currentRotationCosine-currentLocalOffsetY*currentRotationSine,y:currentActorTransform.y+currentLocalOffsetX*currentRotationSine+currentLocalOffsetY*currentRotationCosine};
}

export type PresentationHitResult = {id?:string;targetId?:string;outcome?:'hit'|'guarded'|'miss'|'immune'|'healing';targetHealthDepleted?:boolean;damage?:number; healing?:number};
export type PresentationHitMarker = {time:number; result:PresentationHitResult};
/** 확정 타격과 시점을 일대일 연결한다. 합산 피해를 여러 타격에 복제하지 않는다. */
export function resolvePresentationHitMarkers(currentFrameDurations:number[],currentResultRecord:{
  presentationVersion?:number;targetId?:string;presentationHitTimesMs?:number[];presentationHits?:PresentationHitResult[];damage?:number;healing?:number;
}):PresentationHitMarker[]{
  if(currentResultRecord.presentationVersion!==undefined&&currentResultRecord.presentationVersion!==1)throw Error('지원하지 않는 전투 연출 결과 버전입니다.');
  const currentHitResults=currentResultRecord.presentationHits;
  if(currentResultRecord.presentationVersion===1&&!currentHitResults)throw Error('전투 연출 확정 타격 결과가 없습니다.');
  if(currentHitResults!==undefined&&!currentHitResults.length)throw Error('확정 타격 결과 배열이 비어 있습니다.');
  const currentResolvedResults=currentHitResults??[{damage:currentResultRecord.damage,healing:currentResultRecord.healing}];
  const currentHitIdentifiers=new Set<string>();
  for(const currentHitResult of currentResolvedResults){
    if(currentResultRecord.presentationVersion===1&&(!currentHitResult.id||!currentHitResult.targetId||!currentHitResult.outcome))throw Error('확정 타격 ID·대상·결과가 없습니다.');
    if(currentHitResult.targetId!==undefined&&currentHitResult.targetId!==currentResultRecord.targetId)throw Error('복수 대상 전투 연출은 아직 지원하지 않습니다.');
    if(currentHitResult.id!==undefined){
      if(!currentHitResult.id||currentHitIdentifiers.has(currentHitResult.id))throw Error('타격 ID가 비어 있거나 중복되었습니다.');
      currentHitIdentifiers.add(currentHitResult.id);
    }
    if(currentHitResult.outcome!==undefined&&!['hit','guarded','miss','immune','healing'].includes(currentHitResult.outcome))throw Error('지원하지 않는 타격 결과입니다.');
    if(['miss','immune'].includes(currentHitResult.outcome??'')&&(currentHitResult.damage??0)>0)throw Error('회피·무효 결과에 피해가 포함되어 있습니다.');
    for(const currentResultValue of [currentHitResult.damage,currentHitResult.healing])
      if(currentResultValue!==undefined&&(!Number.isFinite(currentResultValue)||currentResultValue<0))throw Error('타격 결과 수치는 유한한 음이 아닌 값이어야 합니다.');
  }
  const currentResolvedTimes=resolveActionHitTimes(currentFrameDurations,currentResultRecord.presentationHitTimesMs);
  if(currentResultRecord.presentationHitTimesMs?.length&&currentResolvedTimes.length!==currentResolvedResults.length)
    throw Error('타격 시점과 확정 타격 결과의 개수가 다릅니다.');
  return currentResolvedResults.map((currentHitResult,currentHitIndex)=>({time:currentResultRecord.presentationHitTimesMs?.length?currentResolvedTimes[currentHitIndex]:currentResolvedTimes[0],result:{...currentHitResult}}));
}

/** 같은 화면 프레임에 도착한 결과도 서버 순서대로 개별 행에 표시한다. */
export function formatPresentationHitResult(currentHitResult:PresentationHitResult):string {
  const currentOutcomeLabel=currentHitResult.outcome==='guarded'?'방어':currentHitResult.outcome==='miss'?'빗나감':currentHitResult.outcome==='immune'?'무효':'';
  return [currentOutcomeLabel,currentHitResult.damage===undefined?'':String(currentHitResult.damage),
    currentHitResult.healing===undefined?'':'+'+String(currentHitResult.healing)].filter(Boolean).join(' / ');
}

/** 연속 피격은 이전 반동 위치에서 이어서 움직이며 누적 변위는 증가시키지 않는다. */
export function calculatePresentationReactionOffset(currentReactionElapsed:number,currentInitialOffset:number,currentPeakOffset:number,currentRiseDuration:number,currentRecoveryDuration:number):number {
  if(currentReactionElapsed<0||currentReactionElapsed>=currentRecoveryDuration)return 0;
  if(currentReactionElapsed<currentRiseDuration)return currentInitialOffset+(currentPeakOffset-currentInitialOffset)*(currentReactionElapsed/currentRiseDuration);
  return currentPeakOffset*(1-(currentReactionElapsed-currentRiseDuration)/(currentRecoveryDuration-currentRiseDuration));
}

/** 같은 시점 반응은 서버 사망·명중·방어·회피 순으로 선택하고 수치는 모두 보존한다. */
export function selectPresentationReactionResult(currentHitResults:PresentationHitResult[]):PresentationHitResult {
  if(!currentHitResults.length)throw Error('반응에 연결할 타격 결과가 없습니다.');
  const currentReactionPriority=(currentHitResult:PresentationHitResult)=>currentHitResult.targetHealthDepleted?5:currentHitResult.outcome==='hit'||currentHitResult.outcome===undefined?4:currentHitResult.outcome==='guarded'?3:currentHitResult.outcome==='miss'?2:1;
  return currentHitResults.reduce((currentSelectedResult,currentCandidateResult)=>currentReactionPriority(currentCandidateResult)>currentReactionPriority(currentSelectedResult)?currentCandidateResult:currentSelectedResult);
}

/** 저FPS로 늦게 표시된 마지막 반응도 끝까지 유지한다. 서버 결과 시각은 바꾸지 않는다. */
export function hasPresentationPlaybackCompleted(currentElapsedTime:number,currentPlannedDuration:number,currentReactionElapsed:number,currentRecoveryDuration:number,currentEffectDuration:number,currentVisibleResultCount:number):boolean {
  return currentElapsedTime>=currentPlannedDuration&&currentReactionElapsed>=Math.max(currentRecoveryDuration,currentEffectDuration)&&currentVisibleResultCount===0;
}


export const PRESENTATION_RESULT_DURATION_MS=700;
const PRESENTATION_RESULT_FADE_IN_RATIO=0.12;
const PRESENTATION_RESULT_FADE_OUT_START=0.55;
/** 타격 관측 시점부터 부드럽게 나타나 감속 상승하고 사라진다. */
export function samplePresentationResultTransition(currentResultElapsed:number){
  const currentTimeProgress=Math.max(0,Math.min(1,currentResultElapsed/PRESENTATION_RESULT_DURATION_MS));
  const currentFadeInProgress=Math.min(1,currentTimeProgress/PRESENTATION_RESULT_FADE_IN_RATIO);
  const currentFadeOutProgress=Math.max(0,(currentTimeProgress-PRESENTATION_RESULT_FADE_OUT_START)/(1-PRESENTATION_RESULT_FADE_OUT_START));
  const currentSmoothFadeIn=currentFadeInProgress*currentFadeInProgress*(3-2*currentFadeInProgress);
  const currentSmoothFadeOut=currentFadeOutProgress*currentFadeOutProgress*(3-2*currentFadeOutProgress);
  return {alpha:currentSmoothFadeIn*(1-currentSmoothFadeOut),riseProgress:1-(1-currentTimeProgress)**3};
}
