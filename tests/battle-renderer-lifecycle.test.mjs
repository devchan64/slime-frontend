import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';

// 실제 연출·타임라인·배치·설정 코드를 실행하고 그래픽 장치와 에셋 로더만 격리한다.
const currentModuleStubs={
 '../animation/idleActors':`
 const currentAnimationData={animationId:'fixture',version:1,frames:[{frameId:'body',rect:{x:0,y:0,width:10,height:10},anchor:{x:3,y:9}}],clips:[{action:'idle',frames:[{durationMs:100},{durationMs:100}]}]};
 export const ACTOR_IDLE_ASSETS=Object.fromEntries(['human','beast'].map(currentActorKind=>[currentActorKind,{key:currentActorKind,animation:{data:currentAnimationData}}]));
 export function createActorIdleImage(currentRenderScene,currentActorKind,currentActorPosition,currentDisplayHeight){return currentRenderScene.add.image(currentActorPosition.x,currentActorPosition.y,currentActorKind).setScale(currentDisplayHeight/10);}
 export function updateActorIdleFrame(currentRenderImage){currentRenderImage.setOrigin(.3,.9);}
 `,
 '../animation/facing':`export function resolveActorArtworkDirection(){return 'down_left';}`,
 '../terrain/sizes':`export function actorSize(currentUnitRecord){return {scale:currentUnitRecord?.sizeScale??1};}`,
 '../mapViewportRendering':`export function readMapViewportStatus(){return 'active';}`,
 './actionEffects':`export const BATTLE_BACKGROUND_TEXTURE_KEY='forest-background'; export const BATTLE_HEALING_TEXTURE_KEY='healing',BATTLE_IMPACT_TEXTURE_KEY='impact';`,
 phaser:'export default {};',
};
const {outputFiles:currentRendererBundle}=await build({stdin:{contents:"export {BattleActionPresentation} from './src/game/battle/actionPresentation.ts'; export {saveBattleActionSettings,readBattleActionSettings} from './src/game/battle/actionSettings.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',plugins:[{
 name:'isolated-render-device',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/.*/},currentImportRecord=>Object.hasOwn(currentModuleStubs,currentImportRecord.path)?{path:currentImportRecord.path,namespace:'renderer-stub'}:undefined);
 currentBuildContext.onLoad({filter:/.*/,namespace:'renderer-stub'},currentModuleRecord=>({contents:currentModuleStubs[currentModuleRecord.path],loader:'ts'}));
 currentBuildContext.onResolve({filter:/\.yaml\?raw$/},currentImportRecord=>({path:resolve(currentImportRecord.resolveDir,currentImportRecord.path.replace('?raw','')),namespace:'yaml-text'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'yaml-text'},async currentModuleRecord=>({contents:await readFile(currentModuleRecord.path,'utf8'),loader:'text'}));
 }}]});
const {BattleActionPresentation,saveBattleActionSettings,readBattleActionSettings}=await import(`data:text/javascript;base64,${Buffer.from(currentRendererBundle[0].text).toString('base64')}`);
const currentOpaquePixels=new Uint8ClampedArray(400).fill(255);
globalThis.document={hidden:false,createElement:()=>({width:10,height:10,getContext:()=>({drawImage(){},getImageData(){return {data:currentOpaquePixels};}})})};
globalThis.localStorage={getItem:()=>null,setItem(){}};

function createRendererFixture(currentFixtureOptions={}){
 const currentSceneRecord={children:{list:[]},game:{canvas:{dataset:{}}},cameras:{main:{width:currentFixtureOptions.viewportWidth??800,height:currentFixtureOptions.viewportHeight??600,zoom:currentFixtureOptions.cameraZoom??1,getWorldPoint:()=>({x:0,y:0})}},textures:{get:()=>({getSourceImage:()=>({width:10,height:10})})}};
 function createRenderObject(currentObjectKind,currentPositionX=0,currentPositionY=0,currentTextureKey=''){
  const currentObjectRecord={scene:currentSceneRecord,kind:currentObjectKind,x:currentPositionX,y:currentPositionY,texture:currentTextureKey,visible:true,scaleX:1,scaleY:1,rotation:0,flipX:false,originX:.3,originY:.9,frame:{name:'cell:fixture@1:body'},data:{},text:'',alpha:1,
   setCrop(currentCropX,currentCropY,currentCropWidth,currentCropHeight){this.crop={x:currentCropX,y:currentCropY,width:currentCropWidth,height:currentCropHeight};return this;},setResolution(currentTextResolution){this.resolution=currentTextResolution;return this;},setDepth(){return this;},setOrigin(currentOriginX,currentOriginY=currentOriginX){this.originX=currentOriginX;this.originY=currentOriginY;return this;},
   setVisible(currentNextVisible){this.visible=currentNextVisible;return this;},setFlipX(currentNextFlip){this.flipX=currentNextFlip;return this;},
   setScale(currentNextScale){this.scaleX=currentNextScale;this.scaleY=currentNextScale;return this;},setData(currentDataKey,currentDataValue){this.data[currentDataKey]=currentDataValue;return this;},getData(currentDataKey){return this.data[currentDataKey];},
   setX(currentNextPosition){this.x=currentNextPosition;return this;},setPosition(currentNextX,currentNextY){this.x=currentNextX;this.y=currentNextY;return this;},
   setText(currentNextText){this.text=currentNextText;return this;},setAlpha(currentNextAlpha){this.alpha=currentNextAlpha;return this;},setDisplaySize(){return this;},clear(){return this;},fillStyle(){return this;},fillEllipse(){return this;},
   destroy(){currentSceneRecord.children.list=currentSceneRecord.children.list.filter(currentChildObject=>currentChildObject!==this);this.scene=null;},
  };
  currentSceneRecord.children.list.push(currentObjectRecord);return currentObjectRecord;
 }
 currentSceneRecord.add={rectangle:(...currentArguments)=>createRenderObject('rectangle',...currentArguments),image:(...currentArguments)=>createRenderObject('image',...currentArguments),text:(currentPositionX,currentPositionY,currentLabelText,currentLabelStyle)=>Object.assign(createRenderObject('text',currentPositionX,currentPositionY),{text:currentLabelText,style:currentLabelStyle}),graphics:()=>createRenderObject('graphics')};
 const currentOriginalObject=createRenderObject('original');
 const currentHiddenObject=createRenderObject('hidden').setVisible(false);
 const currentRendererInstance=new BattleActionPresentation(currentSceneRecord);
 const currentBaseBattle={id:'fixture',status:'ACTIVE',units:[{id:'hero',name:'test',side:currentFixtureOptions.actorSide??'ally',appearance:'beast',hp:10,sizeScale:currentFixtureOptions.sizeScale??1},{id:'enemy',name:'beast',side:currentFixtureOptions.targetSide??'enemy',appearance:'beast',hp:10,sizeScale:currentFixtureOptions.sizeScale??.5}],log:[]};
 currentRendererInstance.synchronizePresentationState(currentBaseBattle,'local-test');
 const currentActionBattle={...currentBaseBattle,log:[{action:'ATTACK',unitId:'hero',targetId:'enemy',damage:2,...currentFixtureOptions.resultOverrides}]};
 currentRendererInstance.synchronizePresentationState(currentActionBattle,'local-test');
 currentRendererInstance.updateActionPresentation(0);
 return {currentSceneRecord,currentOriginalObject,currentHiddenObject,currentRendererInstance,currentActionBattle};
}
function assertRendererRestored(currentTestFixture){
 assert.equal(currentTestFixture.currentRendererInstance.isPresentationActive(),false);
 assert.equal(currentTestFixture.currentSceneRecord.children.list.length,2);
 assert.equal(currentTestFixture.currentOriginalObject.visible,true);
 assert.equal(currentTestFixture.currentHiddenObject.visible,false);
 assert.deepEqual(currentTestFixture.currentSceneRecord.game.canvas.dataset,{});
 currentTestFixture.currentRendererInstance.destroyActionPresentation();
}
test('지연된 타격도 실제 렌더러에서 효과·반동을 재생하고 전장 객체만 복원한다',()=>{
 const currentTestFixture=createRendererFixture();
 assert.equal(currentTestFixture.currentOriginalObject.visible,false);
 currentTestFixture.currentRendererInstance.updateActionPresentation(1000);
 const currentImpactImage=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.texture==='impact');
 assert.equal(currentImpactImage.visible,true);assert.equal(currentImpactImage.alpha,1);
 assert.equal(currentTestFixture.currentSceneRecord.game.canvas.dataset.battleEffect,'impact');
 const currentDamageLabel=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.text==='2');
 const currentTargetImage=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.texture==='beast');
 assert.ok(currentDamageLabel.y<currentTargetImage.y-9*currentTargetImage.scaleY);
 currentTestFixture.currentRendererInstance.updateActionPresentation(1260);
 assert.equal(currentTestFixture.currentRendererInstance.isPresentationActive(),true);
 currentTestFixture.currentRendererInstance.updateActionPresentation(1700);
 assertRendererRestored(currentTestFixture);
});
test('건너뛰기·크기 변경·전투 종료·숨김·시간 초과는 실제 객체와 표시 상태를 복원한다',()=>{
 for(const currentTerminationReason of ['skip','resize','battle-end','hidden','timeout']){
  const currentTestFixture=createRendererFixture();
  if(currentTerminationReason==='skip')currentTestFixture.currentRendererInstance.skipActionPresentation();
  if(currentTerminationReason==='resize'){currentTestFixture.currentSceneRecord.cameras.main.width=700;currentTestFixture.currentRendererInstance.updateActionPresentation(20);}
  if(currentTerminationReason==='battle-end')currentTestFixture.currentRendererInstance.synchronizePresentationState({...currentTestFixture.currentActionBattle,status:'FINISHED'},'local-test');
  if(currentTerminationReason==='hidden'){document.hidden=true;currentTestFixture.currentRendererInstance.updateActionPresentation(20);document.hidden=false;}
  if(currentTerminationReason==='timeout')currentTestFixture.currentRendererInstance.updateActionPresentation(5001);
  assertRendererRestored(currentTestFixture);
 }
});

test('실제 객체의 소형·중형·대형 배율과 같은 진영 지원 배치를 유지한다',()=>{
 for(const currentSizeScale of [.5,1,1.5]){
  const currentTestFixture=createRendererFixture({sizeScale:currentSizeScale});
  const currentActorImages=currentTestFixture.currentSceneRecord.children.list.filter(currentRenderObject=>['human','beast'].includes(currentRenderObject.texture));
  assert.ok(currentActorImages[0].x<currentActorImages[1].x);
  assert.equal(currentActorImages[0].y,currentActorImages[1].y);
  assert.equal(currentActorImages[0].flipX,true);assert.equal(currentActorImages[1].flipX,false);
  assert.ok(Math.abs(currentActorImages[1].scaleX/currentActorImages[0].scaleX-currentSizeScale)<1e-9);
  currentTestFixture.currentRendererInstance.skipActionPresentation();assertRendererRestored(currentTestFixture);
 }
 const currentTestFixture=createRendererFixture({sizeScale:1.5,actorSide:'enemy',targetSide:'enemy',resultOverrides:{action:'SKILL',presentationMotion:'support',healing:3,damage:undefined}});
 const currentActorImages=currentTestFixture.currentSceneRecord.children.list.filter(currentRenderObject=>currentRenderObject.texture==='beast');
 assert.ok(currentActorImages.every(currentRenderObject=>currentRenderObject.x>400));
 currentTestFixture.currentRendererInstance.updateActionPresentation(240);
 assert.equal(currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.texture==='healing').visible,true);
 currentTestFixture.currentRendererInstance.updateActionPresentation(1180);
 assertRendererRestored(currentTestFixture);
});
test('한 렌더 프레임에 소비한 복수 타격의 수치는 한 번씩 보존한다',()=>{
 const currentTestFixture=createRendererFixture({resultOverrides:{presentationHitTimesMs:[0,50,50],presentationHits:[{damage:1},{damage:2},{damage:3}]}});
 currentTestFixture.currentRendererInstance.updateActionPresentation(500);
 const currentResultObjects=currentTestFixture.currentSceneRecord.children.list.filter(currentRenderObject=>['1','2','3'].includes(currentRenderObject.text));
 assert.equal(currentResultObjects.length,3);
 assert.ok(currentResultObjects.every(currentRenderObject=>currentRenderObject.alpha===0));
 const currentInitialPositions=currentResultObjects.map(currentRenderObject=>currentRenderObject.y);
 assert.equal(new Set(currentInitialPositions).size,3);
 currentTestFixture.currentRendererInstance.updateActionPresentation(600);
 assert.ok(currentResultObjects.every((currentRenderObject,currentResultIndex)=>currentRenderObject.alpha===1&&currentRenderObject.y<currentInitialPositions[currentResultIndex]));
 currentTestFixture.currentRendererInstance.updateActionPresentation(1100);
 assert.ok(currentResultObjects.every(currentRenderObject=>currentRenderObject.alpha>0&&currentRenderObject.alpha<1));
 currentTestFixture.currentRendererInstance.updateActionPresentation(1200);
 assertRendererRestored(currentTestFixture);
});

test('재생 시작 중 데이터 오류가 나도 부분 생성 객체와 입력 잠금을 정리한다',()=>{
 const currentTestFixture=createRendererFixture({resultOverrides:{presentationHitTimesMs:[999]}});
 assertRendererRestored(currentTestFixture);
});
test('같은 전투의 연속 액션에서 객체가 누적되지 않고 서버 스냅샷·카메라를 바꾸지 않는다',()=>{
 const currentTestFixture=createRendererFixture();
 const currentOriginalSnapshot=JSON.stringify(currentTestFixture.currentActionBattle);
 currentTestFixture.currentRendererInstance.updateActionPresentation(240);
 currentTestFixture.currentRendererInstance.updateActionPresentation(1200);
 for(let currentActionIndex=1;currentActionIndex<=20;currentActionIndex++){
  const currentExtendedBattle={...currentTestFixture.currentActionBattle,log:Array.from({length:currentActionIndex+1},()=>({...currentTestFixture.currentActionBattle.log[0]}))};
  currentTestFixture.currentRendererInstance.synchronizePresentationState(currentExtendedBattle,'local-test');
  currentTestFixture.currentRendererInstance.updateActionPresentation(currentActionIndex*2000);
  currentTestFixture.currentRendererInstance.updateActionPresentation(currentActionIndex*2000+240);
  currentTestFixture.currentRendererInstance.updateActionPresentation(currentActionIndex*2000+1200);
  assert.equal(currentTestFixture.currentSceneRecord.children.list.length,2);
 }
 assert.equal(JSON.stringify(currentTestFixture.currentActionBattle),currentOriginalSnapshot);
 assert.equal(currentTestFixture.currentSceneRecord.cameras.main.zoom,1);
 assertRendererRestored(currentTestFixture);
});

test('설정 OFF는 재생·대기열을 해제하고 ON 복귀 시 지난 결과를 재생하지 않는다',()=>{
 const currentTestFixture=createRendererFixture();
 assert.equal(readBattleActionSettings().busy,true);
 const currentQueuedBattle={...currentTestFixture.currentActionBattle,log:[...currentTestFixture.currentActionBattle.log,...currentTestFixture.currentActionBattle.log]};
 currentTestFixture.currentRendererInstance.synchronizePresentationState(currentQueuedBattle,'local-test');
 saveBattleActionSettings(false);
 assert.equal(readBattleActionSettings().busy,false);
 assert.equal(currentTestFixture.currentSceneRecord.children.list.length,2);
 currentTestFixture.currentRendererInstance.synchronizePresentationState(currentQueuedBattle,'local-test');
 saveBattleActionSettings(true);
 currentTestFixture.currentRendererInstance.synchronizePresentationState(currentQueuedBattle,'local-test');
 currentTestFixture.currentRendererInstance.updateActionPresentation(1000);
 assertRendererRestored(currentTestFixture);
});
test('세션 변경은 연출을 정리하고 수신한 현재 전투를 새 기준으로 삼는다',()=>{
 const currentTestFixture=createRendererFixture();
 currentTestFixture.currentRendererInstance.synchronizePresentationState(currentTestFixture.currentActionBattle,'reconnected-session');
 currentTestFixture.currentRendererInstance.updateActionPresentation(1000);
 assertRendererRestored(currentTestFixture);
});

test('생성 배경 위에서 거리를 두고 시작하며 근접 공격만 간격을 좁힌다',()=>{
 for(const currentMotionKind of ['melee','ranged','support']){
  const currentTestFixture=createRendererFixture({resultOverrides:{presentationMotion:currentMotionKind,...(currentMotionKind==='support'?{healing:2,damage:undefined}:{})}});
  assert.ok(currentTestFixture.currentSceneRecord.children.list.some(currentRenderObject=>currentRenderObject.texture==='forest-background'));
  assert.equal(currentTestFixture.currentSceneRecord.children.list.some(currentRenderObject=>currentRenderObject.kind==='rectangle'),true);
  const currentActorImages=currentTestFixture.currentSceneRecord.children.list.filter(currentRenderObject=>['human','beast'].includes(currentRenderObject.texture));
  const currentInitialActorX=currentActorImages[0].x;
  const currentInitialTargetX=currentActorImages[1].x;
  const currentInitialBodyGap=(currentInitialTargetX-3*currentActorImages[1].scaleX)-(currentInitialActorX+3*currentActorImages[0].scaleX);
  assert.ok(currentInitialBodyGap>=800*.18-1);
  currentTestFixture.currentRendererInstance.updateActionPresentation(240);
  if(currentMotionKind==='melee')assert.ok(currentActorImages[0].x>currentInitialActorX+50);
  else assert.equal(currentActorImages[0].x,currentInitialActorX);
  assert.equal(currentActorImages[0].y,currentActorImages[1].y);
  currentTestFixture.currentRendererInstance.skipActionPresentation();assertRendererRestored(currentTestFixture);
 }
});

test('서로 다른 타격의 숫자는 이전 숫자의 수명과 고정 좌표를 갱신하지 않는다',()=>{
 const currentTestFixture=createRendererFixture({resultOverrides:{presentationHitTimesMs:[0,150],presentationHits:[{damage:4},{damage:7}]}});
 currentTestFixture.currentRendererInstance.updateActionPresentation(140);
 currentTestFixture.currentRendererInstance.updateActionPresentation(240);
 const currentFirstLabel=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.text==='4');
 const currentFirstPosition=currentFirstLabel.x;
 currentTestFixture.currentRendererInstance.updateActionPresentation(290);
 const currentSecondLabel=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.text==='7');
 assert.equal(currentFirstLabel.alpha,1);assert.equal(currentSecondLabel.alpha,0);
 assert.equal(currentFirstLabel.x,currentFirstPosition);
 currentTestFixture.currentRendererInstance.updateActionPresentation(840);
 assert.equal(currentFirstLabel.alpha,0);
 assert.ok(currentSecondLabel.alpha>0);
 currentTestFixture.currentRendererInstance.updateActionPresentation(1200);
 assertRendererRestored(currentTestFixture);
});

test('화면 배율이 달라도 연출의 화면상 크기·피격점은 유지하고 카메라를 보존한다',()=>{
 const currentScreenMeasurements=[];
 for(const currentCameraZoom of [.5,1,2]){
  const currentTestFixture=createRendererFixture({cameraZoom:currentCameraZoom});
  currentTestFixture.currentRendererInstance.updateActionPresentation(240);
  const currentTargetImage=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.texture==='beast');
  const currentHitCoordinates=currentTestFixture.currentSceneRecord.game.canvas.dataset.battleHitPoint.split(',').map(Number);
  const currentDamageLabel=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.text==='2');
  const currentScreenFontSize=parseFloat(currentDamageLabel.style.fontSize)*currentCameraZoom;
  assert.ok(Math.abs(currentScreenFontSize-31.68)<.01);
  assert.equal(currentDamageLabel.resolution,Math.max(1,currentCameraZoom));
  currentScreenMeasurements.push([currentTargetImage.x*currentCameraZoom,currentTargetImage.y*currentCameraZoom,currentTargetImage.scaleX*currentCameraZoom,...currentHitCoordinates.map(currentCoordinateValue=>currentCoordinateValue*currentCameraZoom)]);
  currentTestFixture.currentRendererInstance.skipActionPresentation();
  assert.equal(currentTestFixture.currentSceneRecord.cameras.main.zoom,currentCameraZoom);
  assertRendererRestored(currentTestFixture);
 }
 for(const currentMeasurements of currentScreenMeasurements)currentMeasurements.forEach((currentMeasurementValue,currentMeasurementIndex)=>assert.ok(Math.abs(currentMeasurementValue-currentScreenMeasurements[1][currentMeasurementIndex])<.02));
});

test('연출 대기열 초과는 원인을 기록하고 입력과 전장 표시를 회복한다',()=>{
 const currentTestFixture=createRendererFixture();
 const currentOverflowBattle={...currentTestFixture.currentActionBattle,log:Array.from({length:70},(_,currentResultIndex)=>({...currentTestFixture.currentActionBattle.log[0],executionId:'overflow:'+currentResultIndex}))};
 currentTestFixture.currentRendererInstance.synchronizePresentationState(currentOverflowBattle,'local-test');
 assertRendererRestored(currentTestFixture);
});

test('빗나감과 무효는 접촉 효과 없이 확정 표식만 표시한다',()=>{
 for(const currentOutcomeValue of ['miss','immune']){
  const currentTestFixture=createRendererFixture({resultOverrides:{presentationVersion:1,presentationHits:[{id:'result:0',targetId:'enemy',outcome:currentOutcomeValue}]}});
  currentTestFixture.currentRendererInstance.updateActionPresentation(240);
  assert.equal(currentTestFixture.currentSceneRecord.game.canvas.dataset.battleEffect,undefined);
  const currentOutcomeLabel=currentTestFixture.currentSceneRecord.children.list.find(currentRenderObject=>currentRenderObject.text===(currentOutcomeValue==='miss'?'빗나감':'무효'));
  assert.ok(currentOutcomeLabel);
  currentTestFixture.currentRendererInstance.updateActionPresentation(340);
  assert.equal(currentOutcomeLabel.alpha,1);
  currentTestFixture.currentRendererInstance.updateActionPresentation(1200);
  assertRendererRestored(currentTestFixture);
 }
});
