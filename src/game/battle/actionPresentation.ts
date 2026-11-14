import {BATTLE_BACKGROUND_TEXTURE_KEY,BATTLE_HEALING_TEXTURE_KEY,BATTLE_IMPACT_TEXTURE_KEY} from './actionEffects';
import {resolveActorArtworkDirection} from '../animation/facing';
import {calculatePresentationActorLayout,shouldMirrorPresentationActor} from './actionLayout';
import {BATTLE_PRESENTATION_DEFINITION} from './actionDefinitions';
import Phaser from 'phaser';
import type {Battle,Unit} from '../../client/types';
import {ACTOR_IDLE_ASSETS,createActorIdleImage,updateActorIdleFrame,type IdleActorKind} from '../animation/idleActors';
import {actorSize} from '../terrain/sizes';
import {readMapViewportStatus} from '../mapViewportRendering';
import {BattleActionTimeline,PRESENTATION_RESULT_DURATION_MS,samplePresentationResultTransition,hasPresentationPlaybackCompleted,resolvePresentationHitMarkers,formatPresentationHitResult,type PresentationHitMarker,calculatePresentationReactionOffset,selectPresentationReactionResult,collectCrossedHitIndices,transformSpriteHitPoint,type BattleActionEntry,type SpriteHitGeometry} from './actionTimeline';
import {initializeBattleActionSettings,readBattleActionSettings,publishBattleActionBusy,subscribeBattleActionSettings,subscribeBattleActionSkip} from './actionSettings';

const PRESENTATION_LAYER_DEPTH=9000000;
const PRESENTATION_BACKGROUND_HEIGHT_RATIO=0.60;
const PRESENTATION_SURROUND_COLOR=0x07131b;
const PRESENTATION_HEIGHT_RATIO=BATTLE_PRESENTATION_DEFINITION.heightViewportRatio;
const PRESENTATION_GROUND_RATIO=BATTLE_PRESENTATION_DEFINITION.groundViewportRatio;
const PRESENTATION_BODY_GAP=BATTLE_PRESENTATION_DEFINITION.contactBodyGapRatio;
const PRESENTATION_RESULT_GAP_RATIO=0.04;
const PRESENTATION_RESULT_RISE_RATIO=0.16;
const PRESENTATION_RESULT_LANE_RATIO=0.15;
const PRESENTATION_NAME_MINIMUM_PIXELS=10;
const PRESENTATION_RESULT_MINIMUM_PIXELS=12;
const PRESENTATION_TEXT_RESOLUTION_MINIMUM=1;
const PRESENTATION_ALPHA_THRESHOLD=48;
const PRESENTATION_SAMPLE_STEP=2;
const PRESENTATION_EFFECT_DURATION=BATTLE_PRESENTATION_DEFINITION.effectDurationMs;
const PRESENTATION_MAX_DURATION=BATTLE_PRESENTATION_DEFINITION.maximumDurationMs;
const ACTION_LAYOUT_DURATION=BATTLE_PRESENTATION_DEFINITION.layoutDurationMs;
const ACTION_RECOVERY_DURATION=BATTLE_PRESENTATION_DEFINITION.recoveryDurationMs;
type PresentationActor={renderImage:Phaser.GameObjects.Image;actorKind:IdleActorKind;displayHeight:number;basePositionX:number;basePositionY:number;frameGeometry:Map<string,SpriteHitGeometry>;actorNameLabel:Phaser.GameObjects.Text};
type PresentationExecution={actionEntry:BattleActionEntry;startedTimestamp:number;previousElapsedTime:number;hitTimes:number[];hitMarkers:PresentationHitMarker[];visibleHitResults:{text:string;time:number;hitIndex:number;laneIndex:number;originX?:number;originY?:number}[];clipDuration:number;totalDuration:number;actorObjects:PresentationActor[];effectGraphics:Phaser.GameObjects.Graphics;effectImage:Phaser.GameObjects.Image;effectDuration:number;shadowGraphics:Phaser.GameObjects.Graphics;resultTexts:Phaser.GameObjects.Text[];lastHitTimestamp:number|null;lastObservedHitTimestamp:number|null;reactionInitialOffset:number;reactionPeakOffset:number;actorApproachDistance:number;viewportWidth:number;viewportHeight:number};
/** 기존 WebGL 장면 위의 전용 객체만 소유하며 서버 상태와 카메라를 변경하지 않는다. */
export class BattleActionPresentation {
  private currentActionTimeline=new BattleActionTimeline();
  private currentSessionBattleIdentity='';
  private activeActionExecution:PresentationExecution|null=null;
  private ownedRenderObjects=new Set<Phaser.GameObjects.GameObject>();
  private hiddenRenderObjects=new Map<Phaser.GameObjects.GameObject,boolean>();
  private spriteGeometryCache=new Map<string,Map<string,SpriteHitGeometry>>();
  private releaseSettingsListener:()=>void;
  private releaseSkipListener:()=>void;
  constructor(private currentRenderScene:Phaser.Scene){
    initializeBattleActionSettings();
    this.releaseSettingsListener=subscribeBattleActionSettings(()=>{if(!readBattleActionSettings().enabled)this.skipActionPresentation();});
    this.releaseSkipListener=subscribeBattleActionSkip(()=>this.skipActionPresentation());
  }
  ownsPresentationObject(currentRenderObject:Phaser.GameObjects.GameObject){return this.ownedRenderObjects.has(currentRenderObject);}
  isPresentationActive(){return this.activeActionExecution!==null||this.currentActionTimeline.pendingActionEntries.length>0;}
  synchronizePresentationState(currentBattleState:Battle|null,currentSessionIdentity:string){
    const currentNextBattleIdentity=currentBattleState?`${currentSessionIdentity}:${currentBattleState.id}`:'';
    if(currentNextBattleIdentity!==this.currentSessionBattleIdentity){this.skipActionPresentation();this.currentActionTimeline.clearActionTimeline();this.currentSessionBattleIdentity=currentNextBattleIdentity;}
    if(!currentBattleState||currentBattleState.status!=='ACTIVE'){this.skipActionPresentation();this.currentActionTimeline.clearActionTimeline();return;}
    try{this.currentActionTimeline.synchronizeActionResults(currentBattleState,currentSessionIdentity,readBattleActionSettings().enabled);publishBattleActionBusy(this.isPresentationActive());}
    catch(currentPresentationError){this.currentActionTimeline.synchronizeActionResults(currentBattleState,currentSessionIdentity,false);this.failActionPresentation(currentPresentationError);}
  }
  skipActionPresentation(currentFinishReason='skipped'){this.currentActionTimeline.pendingActionEntries.length=0;this.finishActionPresentation(currentFinishReason);}
  destroyActionPresentation(){this.skipActionPresentation();this.currentActionTimeline.clearActionTimeline();this.releaseSettingsListener();this.releaseSkipListener();this.spriteGeometryCache.clear();}
  private failActionPresentation(currentPresentationError:unknown){console.error('전투 액션 연출 중단',this.activeActionExecution?.actionEntry.executionIdentifier,currentPresentationError);this.skipActionPresentation('error');}
  private finishActionPresentation(currentFinishReason='completed'){
    const currentFinishedExecution=this.activeActionExecution;
    for(const currentOwnedObject of this.ownedRenderObjects)if(currentOwnedObject.scene)currentOwnedObject.destroy();
    this.ownedRenderObjects.clear();
    for(const [currentHiddenObject,currentWasVisible] of this.hiddenRenderObjects)if(currentHiddenObject.scene&&(currentHiddenObject as Phaser.GameObjects.Image).setVisible)(currentHiddenObject as Phaser.GameObjects.Image).setVisible(currentWasVisible);
    if(currentFinishedExecution)console.debug('전투 액션 연출 종료',{executionId:currentFinishedExecution.actionEntry.executionIdentifier,reason:currentFinishReason,remainingOwnedObjects:this.ownedRenderObjects.size,sceneObjects:this.currentRenderScene.children.list.length});
    this.hiddenRenderObjects.clear();if(this.currentRenderScene.game?.canvas){delete this.currentRenderScene.game.canvas.dataset.battleAction;delete this.currentRenderScene.game.canvas.dataset.battleHitPoint;delete this.currentRenderScene.game.canvas.dataset.battleEffect;}this.activeActionExecution=null;publishBattleActionBusy(this.currentActionTimeline.pendingActionEntries.length>0);
  }
  private resolvePresentationKind(currentUnitRecord:Unit):IdleActorKind{
    if(currentUnitRecord.side==='ally')return 'human';
    const currentActorKind=currentUnitRecord.monsterTypeId??currentUnitRecord.appearance;
    if(!currentActorKind||!Object.hasOwn(ACTOR_IDLE_ASSETS,currentActorKind))throw Error('미등록 전투 액터: '+currentActorKind);
    return currentActorKind as IdleActorKind;
  }
  private readSpriteGeometry(currentActorKind:IdleActorKind){
    const currentActorAsset=ACTOR_IDLE_ASSETS[currentActorKind];
    const currentCachedGeometry=this.spriteGeometryCache.get(currentActorAsset.key);if(currentCachedGeometry)return currentCachedGeometry;
    const currentTextureSource=this.currentRenderScene.textures.get(currentActorAsset.key).getSourceImage() as HTMLImageElement;
    const currentReadCanvas=document.createElement('canvas');currentReadCanvas.width=currentTextureSource.width;currentReadCanvas.height=currentTextureSource.height;
    const currentReadContext=currentReadCanvas.getContext('2d',{willReadFrequently:true});if(!currentReadContext)throw Error('스프라이트 피격점 분석 캔버스 생성 실패');
    currentReadContext.drawImage(currentTextureSource,0,0);
    const currentPixelData=currentReadContext.getImageData(0,0,currentReadCanvas.width,currentReadCanvas.height).data;
    const currentFrameGeometries=new Map<string,SpriteHitGeometry>();
    for(const currentFrameRecord of currentActorAsset.animation.data.frames){
      const currentFrameRect=currentFrameRecord.rect;
      let currentMinimumX=currentFrameRect.width,currentMaximumX=0,currentMinimumY=currentFrameRect.height,currentMaximumY=0;
      let currentOpaquePointCount=0;
      for(let currentPixelY=0;currentPixelY<currentFrameRect.height;currentPixelY+=PRESENTATION_SAMPLE_STEP)for(let currentPixelX=0;currentPixelX<currentFrameRect.width;currentPixelX+=PRESENTATION_SAMPLE_STEP){
        if(currentPixelData[((currentFrameRect.y+currentPixelY)*currentReadCanvas.width+currentFrameRect.x+currentPixelX)*4+3]<PRESENTATION_ALPHA_THRESHOLD)continue;
        currentMinimumX=Math.min(currentMinimumX,currentPixelX);currentMaximumX=Math.max(currentMaximumX,currentPixelX);currentMinimumY=Math.min(currentMinimumY,currentPixelY);currentMaximumY=Math.max(currentMaximumY,currentPixelY);currentOpaquePointCount++;
      }
      if(!currentOpaquePointCount)throw Error('피격점을 지정할 불투명 영역이 없습니다: '+currentFrameRecord.frameId);
      const currentBodyCenterX=(currentMinimumX+currentMaximumX)/2,currentBodyCenterY=(currentMinimumY+currentMaximumY)/2;
      let currentHitPoint={x:currentBodyCenterX,y:currentBodyCenterY};
      let currentNearestDistance=Infinity;
      // 픽셀별 객체 배열을 만들지 않고 두 번째 순회에서 몸체 중심에 가장 가까운 픽셀을 찾는다.
      for(let currentPixelY=currentMinimumY;currentPixelY<=currentMaximumY;currentPixelY+=PRESENTATION_SAMPLE_STEP)
        for(let currentPixelX=currentMinimumX;currentPixelX<=currentMaximumX;currentPixelX+=PRESENTATION_SAMPLE_STEP){
          if(currentPixelData[((currentFrameRect.y+currentPixelY)*currentReadCanvas.width+currentFrameRect.x+currentPixelX)*4+3]<PRESENTATION_ALPHA_THRESHOLD)continue;
          const currentCandidateDistance=(currentPixelX-currentBodyCenterX)**2+(currentPixelY-currentBodyCenterY)**2;
          if(currentCandidateDistance<currentNearestDistance){currentNearestDistance=currentCandidateDistance;currentHitPoint={x:currentPixelX,y:currentPixelY};}
        }

      currentFrameGeometries.set(`cell:${currentActorAsset.animation.data.animationId}@${currentActorAsset.animation.data.version}:${currentFrameRecord.frameId}`,{anchorX:currentFrameRecord.anchor.x,anchorY:currentFrameRecord.anchor.y,hitX:currentHitPoint.x,hitY:currentHitPoint.y,minimumX:currentMinimumX,maximumX:currentMaximumX,minimumY:currentMinimumY,width:currentMaximumX-currentMinimumX+1,height:currentMaximumY-currentMinimumY+1});
    }
    this.spriteGeometryCache.set(currentActorAsset.key,currentFrameGeometries);return currentFrameGeometries;
  }
  private beginActionPresentation(currentActionEntry:BattleActionEntry,currentRenderTimestamp:number){
    const currentSceneChildren=new Set(this.currentRenderScene.children.list);
    try{
      const currentMainCamera=this.currentRenderScene.cameras.main;
      const currentViewWidth=currentMainCamera.width/currentMainCamera.zoom,currentViewHeight=currentMainCamera.height/currentMainCamera.zoom;
      const currentViewOrigin=currentMainCamera.getWorldPoint(0,0);
      const currentActorUnits=currentActionEntry.actorSnapshot.id===currentActionEntry.targetSnapshot.id?[currentActionEntry.actorSnapshot]:[currentActionEntry.actorSnapshot,currentActionEntry.targetSnapshot];
      const currentMaximumRatio=Math.max(...currentActorUnits.map(currentUnitRecord=>actorSize(currentUnitRecord.side==='enemy'?currentUnitRecord:undefined).scale));
      const currentBaseHeight=Math.min(currentViewHeight*PRESENTATION_HEIGHT_RATIO/currentMaximumRatio,currentViewWidth*0.22/currentMaximumRatio);
      const currentGroundPosition=currentViewOrigin.y+currentViewHeight*PRESENTATION_GROUND_RATIO;
      const currentBackgroundSource=this.currentRenderScene.textures.get(BATTLE_BACKGROUND_TEXTURE_KEY).getSourceImage() as HTMLImageElement;
      const currentBackgroundHeight=currentViewHeight*PRESENTATION_BACKGROUND_HEIGHT_RATIO;
      const currentBackgroundScale=Math.max(currentViewWidth/currentBackgroundSource.width,currentBackgroundHeight/currentBackgroundSource.height);
      const currentBackgroundCropWidth=currentViewWidth/currentBackgroundScale;
      const currentBackgroundCropHeight=currentBackgroundHeight/currentBackgroundScale;
      // 상하 배경을 줄이고 몸체·숫자는 자르지 않는다. 카메라와 실제 전장 크기는 유지한다.
      this.currentRenderScene.add.rectangle(currentViewOrigin.x+currentViewWidth/2,currentViewOrigin.y+currentViewHeight/2,currentViewWidth,currentViewHeight,PRESENTATION_SURROUND_COLOR).setDepth(PRESENTATION_LAYER_DEPTH);
      this.currentRenderScene.add.image(currentViewOrigin.x+currentViewWidth/2,currentViewOrigin.y+currentViewHeight/2,BATTLE_BACKGROUND_TEXTURE_KEY).setOrigin(0.5).setScale(currentBackgroundScale)
        .setCrop((currentBackgroundSource.width-currentBackgroundCropWidth)/2,(currentBackgroundSource.height-currentBackgroundCropHeight)/2,currentBackgroundCropWidth,currentBackgroundCropHeight).setDepth(PRESENTATION_LAYER_DEPTH);
      const currentActorObjects=currentActorUnits.map((currentUnitRecord,currentActorIndex)=>{
        const currentActorKind=this.resolvePresentationKind(currentUnitRecord);
        const currentDisplayHeight=currentBaseHeight*actorSize(currentUnitRecord.side==='enemy'?currentUnitRecord:undefined).scale;
        const currentBasePositionX=currentViewOrigin.x+currentViewWidth*(currentActorUnits.length===1?0.5:currentActorIndex===0?0.34:0.66);
        const currentRenderImage=createActorIdleImage(this.currentRenderScene,currentActorKind,{x:currentBasePositionX,y:currentGroundPosition},currentDisplayHeight,'down_left',currentUnitRecord.id).setDepth(PRESENTATION_LAYER_DEPTH+2);
        // 사용자 지정: 왼쪽 객체는 오른쪽, 오른쪽 객체는 왼쪽을 바라본다.
        const currentSameSide=currentActorUnits.every(currentOtherUnit=>currentOtherUnit.side===currentUnitRecord.side);
        const currentFacesRight=currentActorUnits.length===1?currentUnitRecord.side==='ally':currentSameSide?currentActorIndex===0:currentUnitRecord.side==='ally';
        currentRenderImage.setFlipX(shouldMirrorPresentationActor(resolveActorArtworkDirection(currentActorKind),currentFacesRight));
        const currentActorLabel=this.currentRenderScene.add.text(currentBasePositionX,currentGroundPosition+currentBaseHeight*0.12,currentUnitRecord.name,{fontFamily:'sans-serif',fontSize:`${Math.max(PRESENTATION_NAME_MINIMUM_PIXELS/currentMainCamera.zoom,currentBaseHeight*0.11)}px`,color:currentUnitRecord.side==='ally'?'#9eeaff':'#ffbfad',stroke:'#10251b',strokeThickness:3/currentMainCamera.zoom}).setResolution(Math.max(PRESENTATION_TEXT_RESOLUTION_MINIMUM,currentMainCamera.zoom)).setOrigin(0.5,0).setDepth(PRESENTATION_LAYER_DEPTH+4);
        return {renderImage:currentRenderImage,actorKind:currentActorKind,displayHeight:currentDisplayHeight,basePositionX:currentBasePositionX,basePositionY:currentGroundPosition,frameGeometry:this.readSpriteGeometry(currentActorKind),actorNameLabel:currentActorLabel};
      });
      const currentLayoutBounds=currentActorObjects.map((currentActorObject,currentActorIndex)=>({
        side:currentActorUnits[currentActorIndex].side,
        minimumOffsetX:Math.min(...[...currentActorObject.frameGeometry.values()].map(currentFrameGeometry=>(currentActorObject.renderImage.flipX?currentFrameGeometry.anchorX-currentFrameGeometry.maximumX!:currentFrameGeometry.minimumX!-currentFrameGeometry.anchorX)*currentActorObject.renderImage.scaleX)),
        maximumOffsetX:Math.max(...[...currentActorObject.frameGeometry.values()].map(currentFrameGeometry=>(currentActorObject.renderImage.flipX?currentFrameGeometry.anchorX-currentFrameGeometry.minimumX!:currentFrameGeometry.maximumX!-currentFrameGeometry.anchorX)*currentActorObject.renderImage.scaleX)),
      }));
      const currentContactGap=currentBaseHeight*PRESENTATION_BODY_GAP;
      const currentInitialGap=Math.max(currentContactGap,currentViewWidth*BATTLE_PRESENTATION_DEFINITION.initialGapViewportRatio);
      const currentActorLayout=calculatePresentationActorLayout(currentViewWidth,currentLayoutBounds,currentInitialGap);
      for(const [currentActorIndex,currentActorObject] of currentActorObjects.entries()){
        currentActorObject.basePositionX=currentViewOrigin.x+currentActorLayout.positions[currentActorIndex];
        currentActorObject.displayHeight*=currentActorLayout.scale;
        currentActorObject.renderImage.setScale(currentActorObject.renderImage.scaleX*currentActorLayout.scale).setData('actorDisplayHeight',currentActorObject.displayHeight);
        currentActorObject.actorNameLabel.setX(currentActorObject.basePositionX).setScale(currentActorLayout.scale);
      }
      const currentActorAnimation=ACTOR_IDLE_ASSETS[currentActorObjects[0].actorKind].animation;
      const currentActorClip=currentActorAnimation.data.clips.find(currentClipRecord=>currentClipRecord.action==='idle')!;
      const currentFrameDurations=currentActorClip.frames.map(currentFrameRecord=>currentFrameRecord.durationMs);
      const currentHitMarkers=resolvePresentationHitMarkers(currentFrameDurations,currentActionEntry.resultRecord);
      const currentHitTimes=currentHitMarkers.map(currentHitMarker=>currentHitMarker.time);
      const currentClipDuration=currentFrameDurations.reduce((currentDurationSum,currentFrameDuration)=>currentDurationSum+currentFrameDuration,0);
      const currentHealingAction=currentActionEntry.resultRecord.presentationMotion==='support'||currentActionEntry.resultRecord.healing!==undefined;
      const currentEffectDuration=currentHealingAction?BATTLE_PRESENTATION_DEFINITION.healingEffectDurationMs:PRESENTATION_EFFECT_DURATION;
      const currentTotalDuration=ACTION_LAYOUT_DURATION+Math.max(currentClipDuration,currentHitTimes[currentHitTimes.length-1]+Math.max(ACTION_RECOVERY_DURATION,currentEffectDuration,PRESENTATION_RESULT_DURATION_MS))+ACTION_LAYOUT_DURATION;
      if(currentTotalDuration>PRESENTATION_MAX_DURATION)throw Error('액션 연출 재생 한도 초과');
      const currentEffectImage=this.currentRenderScene.add.image(0,0,currentHealingAction?BATTLE_HEALING_TEXTURE_KEY:BATTLE_IMPACT_TEXTURE_KEY).setOrigin(0.5).setDepth(PRESENTATION_LAYER_DEPTH+3).setVisible(false);
      const currentShadowGraphics=this.currentRenderScene.add.graphics().setDepth(PRESENTATION_LAYER_DEPTH+1);
      const currentEffectGraphics=this.currentRenderScene.add.graphics().setDepth(PRESENTATION_LAYER_DEPTH+3);
      const currentResultTexts=currentHitMarkers.map(currentHitMarker=>this.currentRenderScene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:`${Math.max(PRESENTATION_RESULT_MINIMUM_PIXELS/currentMainCamera.zoom,currentBaseHeight*0.18)}px`,color:currentHitMarker.result.healing!==undefined?'#bcffdc':'#fff3d2',stroke:'#07131b',strokeThickness:2/currentMainCamera.zoom}).setResolution(Math.max(PRESENTATION_TEXT_RESOLUTION_MINIMUM,currentMainCamera.zoom)).setOrigin(0.5,1).setDepth(PRESENTATION_LAYER_DEPTH+4).setAlpha(0));
      this.activeActionExecution={actionEntry:currentActionEntry,startedTimestamp:currentRenderTimestamp,previousElapsedTime:-1,hitTimes:currentHitTimes,hitMarkers:currentHitMarkers,visibleHitResults:[],clipDuration:currentClipDuration,totalDuration:currentTotalDuration,actorObjects:currentActorObjects,effectGraphics:currentEffectGraphics,effectImage:currentEffectImage,effectDuration:currentEffectDuration,shadowGraphics:currentShadowGraphics,resultTexts:currentResultTexts,lastHitTimestamp:null,lastObservedHitTimestamp:null,reactionInitialOffset:0,reactionPeakOffset:0,actorApproachDistance:(currentInitialGap-currentContactGap)*currentActorLayout.scale,viewportWidth:currentMainCamera.width,viewportHeight:currentMainCamera.height};
    }finally{for(const currentRenderObject of this.currentRenderScene.children.list)if(!currentSceneChildren.has(currentRenderObject))this.ownedRenderObjects.add(currentRenderObject);}
    console.debug('전투 액션 연출 시작',{executionId:currentActionEntry.executionIdentifier,definitionVersion:BATTLE_PRESENTATION_DEFINITION.definitionVersion,clipPolicy:BATTLE_PRESENTATION_DEFINITION.attackClipPolicy,markers:this.activeActionExecution?.hitTimes});
    publishBattleActionBusy(true);
  }
  updateActionPresentation(currentRenderTimestamp:number){
    try{
      if(document.hidden||readMapViewportStatus()==='suspended'||!readBattleActionSettings().enabled){this.skipActionPresentation('hidden-or-disabled');return;}
      if(!this.activeActionExecution){const currentNextEntry=this.currentActionTimeline.pendingActionEntries.shift();if(currentNextEntry)this.beginActionPresentation(currentNextEntry,currentRenderTimestamp);}
      const currentExecution=this.activeActionExecution;if(!currentExecution)return;
      if(this.currentRenderScene.cameras.main.width!==currentExecution.viewportWidth||this.currentRenderScene.cameras.main.height!==currentExecution.viewportHeight){this.skipActionPresentation('resized');return;}
      const currentElapsedTime=currentRenderTimestamp-currentExecution.startedTimestamp;
      if(currentElapsedTime>PRESENTATION_MAX_DURATION)throw Error('전투 액션 연출 실제 재생 시간 한도 초과');
      for(const currentRenderObject of this.currentRenderScene.children.list){
        if(this.ownedRenderObjects.has(currentRenderObject)||currentRenderObject.getData('characterOutlineLayer'))continue;
        const currentVisibleObject=currentRenderObject as Phaser.GameObjects.Image;
        if(currentVisibleObject.setVisible){if(!this.hiddenRenderObjects.has(currentRenderObject))this.hiddenRenderObjects.set(currentRenderObject,currentVisibleObject.visible);currentVisibleObject.setVisible(false);}
      }
      const currentClipElapsed=Math.max(0,currentElapsedTime-ACTION_LAYOUT_DURATION);
      const currentCrossedHits=currentElapsedTime>=ACTION_LAYOUT_DURATION?collectCrossedHitIndices(currentExecution.hitTimes,currentExecution.previousElapsedTime,currentClipElapsed):[];
      for(const currentHitIndex of currentCrossedHits){
        const currentMarkerTime=currentExecution.hitTimes[currentHitIndex];
        if(currentExecution.lastHitTimestamp!==currentMarkerTime){
          currentExecution.reactionInitialOffset=currentExecution.lastObservedHitTimestamp===null?0:calculatePresentationReactionOffset(currentClipElapsed-currentExecution.lastObservedHitTimestamp,currentExecution.reactionInitialOffset,currentExecution.reactionPeakOffset,BATTLE_PRESENTATION_DEFINITION.reactionRiseMs,ACTION_RECOVERY_DURATION);
          const currentGroupResult=selectPresentationReactionResult(currentExecution.hitMarkers.filter(currentHitMarker=>currentHitMarker.time===currentMarkerTime).map(currentHitMarker=>currentHitMarker.result));
          currentExecution.reactionPeakOffset=currentGroupResult.outcome==='healing'||currentGroupResult.outcome==='immune'?0:currentGroupResult.outcome==='guarded'?BATTLE_PRESENTATION_DEFINITION.guardBodyRatio:currentGroupResult.outcome==='miss'?-BATTLE_PRESENTATION_DEFINITION.missBodyRatio:BATTLE_PRESENTATION_DEFINITION.hitBodyRatio;
        }
        currentExecution.lastHitTimestamp=currentMarkerTime;
        currentExecution.lastObservedHitTimestamp=currentClipElapsed;
        console.debug('전투 액션 타격',{executionId:currentExecution.actionEntry.executionIdentifier,hitIndex:currentHitIndex,expectedMs:currentMarkerTime,observedMs:currentClipElapsed,delayMs:currentClipElapsed-currentMarkerTime});
        const currentHitMarker=currentExecution.hitMarkers[currentHitIndex];
        const currentOccupiedLanes=new Set(currentExecution.visibleHitResults.filter(currentHitResult=>currentClipElapsed-currentHitResult.time<PRESENTATION_RESULT_DURATION_MS).map(currentHitResult=>currentHitResult.laneIndex));
        let currentResultLaneIndex=0;
        while(currentOccupiedLanes.has(currentResultLaneIndex))currentResultLaneIndex++;
        currentExecution.visibleHitResults.push({text:formatPresentationHitResult(currentHitMarker.result),time:currentClipElapsed,hitIndex:currentHitIndex,laneIndex:currentResultLaneIndex});
      }
      currentExecution.visibleHitResults=currentExecution.visibleHitResults.filter(currentHitResult=>{
        if(currentClipElapsed-currentHitResult.time<PRESENTATION_RESULT_DURATION_MS)return true;
        currentExecution.resultTexts[currentHitResult.hitIndex].setAlpha(0);return false;
      });
      if(currentElapsedTime>=ACTION_LAYOUT_DURATION)currentExecution.previousElapsedTime=currentClipElapsed;
      const currentPresentationMotion=currentExecution.actionEntry.resultRecord.presentationMotion??(currentExecution.actionEntry.resultRecord.healing!==undefined?'support':'melee');
      const currentAttackDirection=currentExecution.actorObjects.length===1?0:Math.sign(currentExecution.actorObjects[1].basePositionX-currentExecution.actorObjects[0].basePositionX);
      const currentLastHit=currentExecution.lastObservedHitTimestamp;
      const currentLastHitIndex=currentExecution.hitTimes.reduce((currentLastIndex,currentHitTime,currentHitIndex)=>currentHitTime<=currentClipElapsed?currentHitIndex:currentLastIndex,-1);
      const currentReactionResult=currentLastHitIndex<0?undefined:selectPresentationReactionResult(currentExecution.hitMarkers.filter(currentHitMarker=>currentHitMarker.time===currentExecution.hitTimes[currentLastHitIndex]).map(currentHitMarker=>currentHitMarker.result));
      const currentHitOutcome=currentReactionResult?.outcome;

      const currentReactionElapsed=currentLastHit===null?Infinity:currentClipElapsed-currentLastHit;
      currentExecution.effectGraphics.clear();
      currentExecution.shadowGraphics.clear();
      for(const [currentActorIndex,currentActorObject] of currentExecution.actorObjects.entries()){
        const currentActorImage=currentActorObject.renderImage;
        const currentLastMarker=currentExecution.hitTimes[currentExecution.hitTimes.length-1];
        const currentPreparationProgress=Math.min(1,currentClipElapsed/Math.max(1,currentExecution.hitTimes[0]));
        const currentApproachProgress=currentPreparationProgress*currentPreparationProgress*(3-2*currentPreparationProgress);
        const currentApproachOffset=currentExecution.actorApproachDistance*(currentClipElapsed<=currentLastMarker?currentApproachProgress:Math.max(0,1-(currentClipElapsed-currentLastMarker)/ACTION_RECOVERY_DURATION));
        const currentAttackOffset=currentClipElapsed<=currentLastMarker?(-BATTLE_PRESENTATION_DEFINITION.preparationBodyRatio+(BATTLE_PRESENTATION_DEFINITION.preparationBodyRatio+BATTLE_PRESENTATION_DEFINITION.attackBodyRatio)*currentPreparationProgress)*currentActorObject.displayHeight:BATTLE_PRESENTATION_DEFINITION.attackBodyRatio*currentActorObject.displayHeight*Math.max(0,1-(currentClipElapsed-currentLastMarker)/ACTION_RECOVERY_DURATION);
        const currentReactionOffset=calculatePresentationReactionOffset(currentReactionElapsed,currentExecution.reactionInitialOffset,currentExecution.reactionPeakOffset,BATTLE_PRESENTATION_DEFINITION.reactionRiseMs,ACTION_RECOVERY_DURATION)*currentActorObject.displayHeight;
        currentActorImage.setPosition(currentActorObject.basePositionX+currentAttackDirection*(currentActorIndex===0?(currentPresentationMotion==='melee'?currentApproachOffset+currentAttackOffset:0):currentReactionOffset),currentActorObject.basePositionY);
        currentActorObject.actorNameLabel.setX(currentActorImage.x);
        currentActorImage.setAlpha(currentActorIndex===currentExecution.actorObjects.length-1&&currentReactionResult?.targetHealthDepleted?0.55:1);
        updateActorIdleFrame(currentActorImage,'down_left',currentActorIndex===0?currentClipElapsed:Math.max(0,currentReactionElapsed===Infinity?currentClipElapsed:currentReactionElapsed));
        if(currentActorImage.flipX)currentActorImage.setOrigin(1-currentActorImage.originX,currentActorImage.originY);
        currentExecution.shadowGraphics.fillStyle(0x000000,0.45).fillEllipse(currentActorImage.x,currentActorObject.basePositionY,currentActorObject.displayHeight*0.48,currentActorObject.displayHeight*0.10);
      }
      const currentTargetActor=currentExecution.actorObjects[currentExecution.actorObjects.length-1];
      const currentFrameGeometry=currentTargetActor.frameGeometry.get(currentTargetActor.renderImage.frame.name)!;
      const currentHitPosition=transformSpriteHitPoint(currentFrameGeometry,{x:currentTargetActor.renderImage.x,y:currentTargetActor.renderImage.y,scale:currentTargetActor.renderImage.scaleX,rotation:currentTargetActor.renderImage.rotation,flipped:currentTargetActor.renderImage.flipX});
      for(const currentHitResult of currentExecution.visibleHitResults){
        currentHitResult.originX??=currentHitPosition.x;
        currentHitResult.originY??=currentTargetActor.renderImage.y+(currentFrameGeometry.minimumY!-currentFrameGeometry.anchorY)*currentTargetActor.renderImage.scaleY-currentTargetActor.displayHeight*(PRESENTATION_RESULT_GAP_RATIO+currentHitResult.laneIndex*PRESENTATION_RESULT_LANE_RATIO);
        const currentResultTransition=samplePresentationResultTransition(currentClipElapsed-currentHitResult.time);
        currentExecution.resultTexts[currentHitResult.hitIndex].setText(currentHitResult.text)
          .setPosition(currentHitResult.originX,currentHitResult.originY-currentTargetActor.displayHeight*PRESENTATION_RESULT_RISE_RATIO*currentResultTransition.riseProgress)
          .setAlpha(currentResultTransition.alpha);
      }
      const currentEffectVisible=currentReactionElapsed<currentExecution.effectDuration&&currentHitOutcome!=='miss'&&currentHitOutcome!=='immune';
      currentExecution.effectImage.setVisible(currentEffectVisible);
      if(currentEffectVisible)this.currentRenderScene.game.canvas.dataset.battleEffect=currentPresentationMotion==='support'?'healing':'impact';
      else delete this.currentRenderScene.game.canvas.dataset.battleEffect;
      if(currentEffectVisible){
        const currentEffectProgress=currentReactionElapsed/currentExecution.effectDuration;
        const currentHealingEffect=currentPresentationMotion==='support';
        const currentEffectHeight=currentTargetActor.displayHeight*(currentHealingEffect?1.2:0.75)*(currentHealingEffect?0.85+0.15*currentEffectProgress:0.6+0.4*currentEffectProgress);
        currentExecution.effectImage.setPosition(currentHitPosition.x,currentHitPosition.y-(currentHealingEffect?currentTargetActor.displayHeight*0.12*currentEffectProgress:0))
          .setDisplaySize(currentEffectHeight,currentEffectHeight).setAlpha(currentHealingEffect?Math.sin(Math.PI*currentEffectProgress):1-currentEffectProgress);
      }
      if(hasPresentationPlaybackCompleted(currentElapsedTime,currentExecution.totalDuration,currentReactionElapsed,ACTION_RECOVERY_DURATION,currentExecution.effectDuration,currentExecution.visibleHitResults.length)){this.finishActionPresentation();return;}
      this.currentRenderScene.game.canvas.dataset.battleAction=currentExecution.actionEntry.executionIdentifier;
      this.currentRenderScene.game.canvas.dataset.battleHitPoint=`${currentHitPosition.x.toFixed(2)},${currentHitPosition.y.toFixed(2)}`;
    }catch(currentPresentationError){this.failActionPresentation(currentPresentationError);}
  }
}
