import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/battle/actionTimeline.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {samplePresentationResultTransition,hasPresentationPlaybackCompleted,BattleActionTimeline,calculatePresentationReactionOffset,selectPresentationReactionResult,resolvePresentationHitMarkers,formatPresentationHitResult,resolveActionHitTimes,collectCrossedHitIndices,transformSpriteHitPoint}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('가변 프레임의 마지막 진입과 복수 타격, 저FPS에서도 각 타격을 한 번 처리한다',()=>{
 assert.deepEqual(resolveActionHitTimes([100,150,200]),[250]);
 assert.deepEqual(resolveActionHitTimes([100]),[0]);
 const currentHitTimes=resolveActionHitTimes([100,150,200],[0,100,100,300]);
 assert.deepEqual(collectCrossedHitIndices(currentHitTimes,-1,200),[0,1,2]);
 assert.deepEqual(collectCrossedHitIndices(currentHitTimes,200,500),[3]);
 for(const currentInvalidMarkers of [[450],[-1],[300,100],[NaN]])assert.throws(()=>resolveActionHitTimes([100,150,200],currentInvalidMarkers));
});
test('작은 대상의 비중앙 앵커·반전·회전·배율은 피격점을 같은 몸체 픽셀에 유지한다',()=>{
 const currentFrameGeometry={anchorX:80,anchorY:190,hitX:110,hitY:120,width:160,height:180};
 for(const currentSizeScale of [0.25,0.5,0.75,1]){
  assert.deepEqual(transformSpriteHitPoint(currentFrameGeometry,{x:300,y:500,scale:currentSizeScale,rotation:0,flipped:false}),{x:300+30*currentSizeScale,y:500-70*currentSizeScale});
  assert.deepEqual(transformSpriteHitPoint(currentFrameGeometry,{x:300,y:500,scale:currentSizeScale,rotation:0,flipped:true}),{x:300-30*currentSizeScale,y:500-70*currentSizeScale});
  const currentRotatedHit=transformSpriteHitPoint(currentFrameGeometry,{x:300,y:500,scale:currentSizeScale,rotation:Math.PI/2,flipped:false});
  assert.ok(Math.abs(currentRotatedHit.x-(300+70*currentSizeScale))<1e-9);
 }
});
test('매 액션을 순서대로 수집하고 최초 접속·중복 수신·OFF·재진입의 과거 공격을 재생하지 않는다',()=>{
 const currentTimeline=new BattleActionTimeline();
 const currentBaseBattle={id:'battle',units:[{id:'hero',hp:10},{id:'target',hp:10}],log:[]};
 const currentAttackResult={action:'ATTACK',unitId:'hero',targetId:'target',damage:2};
 currentTimeline.synchronizeActionResults(currentBaseBattle,'session',true);
 const currentUpdatedBattle={...currentBaseBattle,log:[currentAttackResult,currentAttackResult],units:[{id:'hero',hp:10},{id:'target',hp:6}]};
 currentTimeline.synchronizeActionResults(currentUpdatedBattle,'session',true);
 assert.equal(currentTimeline.pendingActionEntries.length,2);
 assert.equal(new Set(currentTimeline.pendingActionEntries.map(currentEntry=>currentEntry.executionIdentifier)).size,2);
 currentTimeline.synchronizeActionResults(currentUpdatedBattle,'session',true);assert.equal(currentTimeline.pendingActionEntries.length,2);
 currentTimeline.synchronizeActionResults(currentUpdatedBattle,'session',false);assert.equal(currentTimeline.pendingActionEntries.length,0);
 currentTimeline.synchronizeActionResults(currentUpdatedBattle,'session',true);assert.equal(currentTimeline.pendingActionEntries.length,0);
 currentTimeline.synchronizeActionResults(currentUpdatedBattle,'new-session',true);assert.equal(currentTimeline.pendingActionEntries.length,0);
 assert.equal(currentUpdatedBattle.units[1].hp,6);
});

test('공격 결과의 정수 HP 0만으로 생존 대상 연출을 삭제하지 않는다',()=>{
 const currentTimeline=new BattleActionTimeline();
 const currentInitialBattle={id:'fraction',units:[{id:'hero',hp:10},{id:'target',hp:1}],log:[]};
 currentTimeline.synchronizeActionResults(currentInitialBattle,'session',true);
 currentTimeline.synchronizeActionResults({...currentInitialBattle,units:[currentInitialBattle.units[0],{id:'target',hp:0,healthDepleted:false}],log:[{action:'ATTACK',unitId:'hero',targetId:'target',damage:1,targetHp:0}]},'session',true);
 assert.equal(currentTimeline.pendingActionEntries.length,1);
 assert.equal(currentTimeline.pendingActionEntries[0].targetSnapshot.id,'target');
});

test('시점 미지정 다중 타격은 모두 마지막 프레임에 연결하고 합산 피해를 복제하지 않는다',()=>{
 const currentHitMarkers=resolvePresentationHitMarkers([100,150,200],{damage:9,presentationHits:[{damage:2},{damage:3},{damage:4}]});
 assert.deepEqual(currentHitMarkers.map(currentHitMarker=>currentHitMarker.time),[250,250,250]);
 assert.deepEqual(currentHitMarkers.map(currentHitMarker=>formatPresentationHitResult(currentHitMarker.result)),['2','3','4']);
 assert.deepEqual(collectCrossedHitIndices(currentHitMarkers.map(currentHitMarker=>currentHitMarker.time),100,900),[0,1,2]);
 assert.deepEqual(resolvePresentationHitMarkers([100],{healing:5}),[{time:0,result:{damage:undefined,healing:5}}]);
 assert.equal(formatPresentationHitResult({healing:5}),'+5');
 assert.equal(formatPresentationHitResult({damage:0}),'0');
});
test('마커 누락·초과·잘못된 확정 결과를 기본값으로 덮지 않는다',()=>{
 for(const currentInvalidResult of [
  {presentationHits:[]},
  {presentationHitTimesMs:[0,100],damage:9},
  {presentationHitTimesMs:[0],presentationHits:[{damage:2},{damage:3}]},
  {presentationHits:[{damage:NaN}]},
  {presentationHits:[{healing:-1}]},
 ])assert.throws(()=>resolvePresentationHitMarkers([100,150,200],currentInvalidResult));
 const currentHitMarkers=resolvePresentationHitMarkers([100,150,200],{presentationHitTimesMs:[0,100,100],presentationHits:[{damage:2},{damage:3},{damage:4}]});
 assert.deepEqual(currentHitMarkers.map(currentHitMarker=>currentHitMarker.time),[0,100,100]);
});

test('서버 버전 1의 대상·타격 ID·판정 계약을 검증하고 방어·회복 수치를 구분한다',()=>{
 const currentResultRecord={presentationVersion:1,targetId:'enemy',presentationHits:[{id:'hit-1',targetId:'enemy',outcome:'guarded',damage:2}]};
 assert.equal(formatPresentationHitResult(resolvePresentationHitMarkers([100],currentResultRecord)[0].result),'방어 / 2');
 for(const currentInvalidRecord of [
  {...currentResultRecord,presentationVersion:2},
  {...currentResultRecord,presentationHits:undefined},
  {...currentResultRecord,presentationHits:[{damage:2}]},
  {...currentResultRecord,presentationHits:[{id:'hit-1',targetId:'other',outcome:'hit',damage:2}]},
  {...currentResultRecord,presentationHits:[...currentResultRecord.presentationHits,...currentResultRecord.presentationHits]},
  {...currentResultRecord,presentationHits:[{id:'hit-1',targetId:'enemy',outcome:'miss',damage:2}]},
 ])assert.throws(()=>resolvePresentationHitMarkers([100],currentInvalidRecord));
 assert.equal(formatPresentationHitResult({outcome:'miss'}),'빗나감');
 assert.equal(formatPresentationHitResult({outcome:'immune'}),'무효');
});

const {outputFiles: currentLayoutFiles}=await build({entryPoints:['src/game/battle/actionLayout.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {calculatePresentationActorLayout,shouldMirrorPresentationActor}=await import(`data:text/javascript;base64,${Buffer.from(currentLayoutFiles[0].text).toString('base64')}`);
test('소형부터 대형까지 몸체 경계와 진영을 보존하고 좁은 화면에도 배치한다',()=>{
 for(const currentViewportWidth of [240,800,1600])for(const currentSizeRatio of [.5,1,1.5,2]){
  for(const currentActorSides of [['ally','enemy'],['enemy','ally'],['ally','ally'],['enemy','enemy']]){
   const currentActorBounds=currentActorSides.map((currentActorSide,currentActorIndex)=>({side:currentActorSide,minimumOffsetX:-30*(currentActorIndex?currentSizeRatio:1),maximumOffsetX:100*(currentActorIndex?currentSizeRatio:1)}));
   const currentLayoutResult=calculatePresentationActorLayout(currentViewportWidth,currentActorBounds,20);
   currentActorBounds.forEach((currentActorBound,currentActorIndex)=>{
    const currentLeftEdge=currentLayoutResult.positions[currentActorIndex]+currentActorBound.minimumOffsetX*currentLayoutResult.scale;
    const currentRightEdge=currentLayoutResult.positions[currentActorIndex]+currentActorBound.maximumOffsetX*currentLayoutResult.scale;
    assert.ok(currentLeftEdge>=0&&currentRightEdge<=currentViewportWidth);
    if(currentActorSides[0]===currentActorSides[1])assert.ok(currentActorBound.side==='ally'?currentRightEdge<=currentViewportWidth/2:currentLeftEdge>=currentViewportWidth/2);
   });
   if(currentActorSides[0]!==currentActorSides[1]){
    const currentAllyIndex=currentActorSides.indexOf('ally'),currentEnemyIndex=currentActorSides.indexOf('enemy');
    const currentAllyLeft=currentLayoutResult.positions[currentAllyIndex]+currentActorBounds[currentAllyIndex].minimumOffsetX*currentLayoutResult.scale;
    const currentAllyRight=currentLayoutResult.positions[currentAllyIndex]+currentActorBounds[currentAllyIndex].maximumOffsetX*currentLayoutResult.scale;
    const currentEnemyLeft=currentLayoutResult.positions[currentEnemyIndex]+currentActorBounds[currentEnemyIndex].minimumOffsetX*currentLayoutResult.scale;
    const currentEnemyRight=currentLayoutResult.positions[currentEnemyIndex]+currentActorBounds[currentEnemyIndex].maximumOffsetX*currentLayoutResult.scale;
    assert.ok(Math.abs(currentAllyLeft-(currentViewportWidth-currentEnemyRight))<1e-8);
    assert.ok(Math.abs(currentEnemyLeft-currentAllyRight-20*currentLayoutResult.scale)<1e-8);
   }
  }
 }
 const currentSingleActor=calculatePresentationActorLayout(800,[{side:'ally',minimumOffsetX:-10,maximumOffsetX:80}],20);
 assert.equal(currentSingleActor.positions.length,1);
});

const {outputFiles: currentDefinitionFiles}=await build({entryPoints:['src/game/battle/definitionSchema.ts'],bundle:true,write:false,platform:'browser',format:'esm'});
const {parseBattlePresentationDefinition}=await import(`data:text/javascript;base64,${Buffer.from(currentDefinitionFiles[0].text).toString('base64')}`);
const {readFile:readDefinitionFile}=await import('node:fs/promises');
const currentDefinitionSource=await readDefinitionFile('src/game/battle/actionDefinitions.yaml','utf8');
test('연출 정의의 미구현 모션·효과 정책은 명시하고 잘못된 게시 데이터를 거절한다',()=>{
 const currentDefinitionRecord=parseBattlePresentationDefinition(currentDefinitionSource);
 assert.equal(currentDefinitionRecord.attackClipPolicy,'registered-idle');
 assert.equal(currentDefinitionRecord.projectilePolicy,'instant-effect');
 for(const currentInvalidSource of [
  currentDefinitionSource+'unexpected: true\n',
  currentDefinitionSource+'schemaVersion: 1\n',
  currentDefinitionSource.replace('schemaVersion: 1','schemaVersion: 2'),
  currentDefinitionSource.replace('recoveryDurationMs: 280','recoveryDurationMs: -1'),
  currentDefinitionSource.replace('maximumDurationMs: 5000','maximumDurationMs: 6000'),
  currentDefinitionSource.replace('projectilePolicy: instant-effect','projectilePolicy: invented-projectile'),
 ])assert.throws(()=>parseBattlePresentationDefinition(currentInvalidSource));
});

test('연속 타격 반동은 현재 위치에서 이어지고 동시 반응은 사망·명중 우선이다',()=>{
 const currentPriorOffset=calculatePresentationReactionOffset(100,0,.06,35,280);
 assert.ok(currentPriorOffset>0&&currentPriorOffset<.06);
 assert.equal(calculatePresentationReactionOffset(0,currentPriorOffset,.06,35,280),currentPriorOffset);
 assert.equal(calculatePresentationReactionOffset(35,currentPriorOffset,.06,35,280),.06);
 assert.equal(calculatePresentationReactionOffset(280,currentPriorOffset,.06,35,280),0);
 assert.equal(selectPresentationReactionResult([{outcome:'miss'},{outcome:'hit'},{outcome:'guarded'}]).outcome,'hit');
 assert.equal(selectPresentationReactionResult([{outcome:'hit'},{outcome:'guarded',targetHealthDepleted:true}]).targetHealthDepleted,true);
});

test('좌측은 오른쪽·우측은 왼쪽을 보되 원본 방향이 같으면 반전하지 않는다',()=>{
 assert.equal(shouldMirrorPresentationActor('down_right',true),false);
 assert.equal(shouldMirrorPresentationActor('down_left',true),true);
 assert.equal(shouldMirrorPresentationActor('down_right',false),true);
 assert.equal(shouldMirrorPresentationActor('down_left',false),false);
});

test('지연 표시된 마지막 타격은 숫자·효과·반동 종료 전까지 연출을 유지한다',()=>{
 assert.equal(hasPresentationPlaybackCompleted(3000,1800,0,280,260,1),false);
 assert.equal(hasPresentationPlaybackCompleted(3260,1800,260,280,260,0),false);
 assert.equal(hasPresentationPlaybackCompleted(3280,1800,280,280,260,0),true);
 assert.equal(hasPresentationPlaybackCompleted(3280,1800,280,280,800,0),false);
 assert.equal(hasPresentationPlaybackCompleted(3800,1800,800,280,800,0),true);
 assert.equal(hasPresentationPlaybackCompleted(1000,1800,800,280,800,0),false);
});

test('누적 로그 끝에 같은 서버 실행 ID가 다시 추가되어도 한 번만 재생한다',()=>{
 const currentTimeline=new BattleActionTimeline();
 const currentBaseBattle={id:'battle',units:[{id:'hero',hp:10},{id:'enemy',hp:10}],log:[]};
 const currentActionResult={action:'ATTACK',unitId:'hero',targetId:'enemy',damage:2,executionId:'action-1'};
 currentTimeline.synchronizeActionResults(currentBaseBattle,'session',true);
 currentTimeline.synchronizeActionResults({...currentBaseBattle,log:[currentActionResult]},'session',true);
 currentTimeline.synchronizeActionResults({...currentBaseBattle,log:[currentActionResult,{...currentActionResult}]},'session',true);
 assert.equal(currentTimeline.pendingActionEntries.length,1);
 currentTimeline.clearActionTimeline();
 currentTimeline.synchronizeActionResults({...currentBaseBattle,log:[currentActionResult]},'session-2',true);
 currentTimeline.synchronizeActionResults({...currentBaseBattle,log:[currentActionResult,{...currentActionResult}]},'session-2',true);
 assert.equal(currentTimeline.pendingActionEntries.length,0);
});

test('결과 숫자는 부드럽게 나타나 감속 상승한 뒤 완전히 사라진다',()=>{
 assert.deepEqual(samplePresentationResultTransition(0),{alpha:0,riseProgress:0});
 assert.equal(samplePresentationResultTransition(84).alpha,1);
 assert.equal(samplePresentationResultTransition(385).alpha,1);
 assert.deepEqual(samplePresentationResultTransition(700),{alpha:0,riseProgress:1});
 assert.ok(samplePresentationResultTransition(600).alpha>0&&samplePresentationResultTransition(600).alpha<1);
 assert.ok(samplePresentationResultTransition(200).riseProgress<samplePresentationResultTransition(400).riseProgress);
});
