import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledTimelineModule = await build({entryPoints:['src/game/animation/fieldBattleTimeline.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {FieldBattleTimeline} = await import(`data:text/javascript;base64,${Buffer.from(compiledTimelineModule.outputFiles[0].text).toString('base64')}`);
const currentEventRecord = {schemaVersion:1,eventId:'end-one',channelId:'meadow',mapId:'meadow',battleId:'battle-one',monsterId:'monster-one',phase:'ENDED',effect:'MONSTER_VANISH',position:{column:3,row:4},occurredAt:100,expiresAt:102};
const currentStateRecord = {channel:{id:'meadow'},generation:1,serverTime:100,mapChatBattleEvents:[currentEventRecord]};

test('중복 이벤트·재연결 스냅샷·오래된 응답은 소멸을 처음부터 다시 재생하지 않는다',()=>{
 const currentEffectTimeline = new FieldBattleTimeline();
 currentEffectTimeline.synchronizeBattleEvents(currentStateRecord,0);
 assert.equal(currentEffectTimeline.sampleBattleEffects(500)[0].progress,0.25);
 currentEffectTimeline.synchronizeBattleEvents(currentStateRecord,1000);
 assert.equal(currentEffectTimeline.sampleBattleEffects(1000).length,1);
 assert.equal(currentEffectTimeline.sampleBattleEffects(1000)[0].progress,0.5);
 assert.deepEqual(currentEffectTimeline.sampleBattleEffects(2000),[]);
 currentEffectTimeline.synchronizeBattleEvents(currentStateRecord,2100);
 assert.deepEqual(currentEffectTimeline.sampleBattleEffects(2100),[]);
});
test('관찰자 두 명은 동일한 서버 종료 시각으로 남은 효과를 표시한다',()=>{
 for(const currentEffectTimeline of [new FieldBattleTimeline(),new FieldBattleTimeline()]){
  currentEffectTimeline.synchronizeBattleEvents({...currentStateRecord,serverTime:101},1000);
  assert.equal(currentEffectTimeline.sampleBattleEffects(1000)[0].progress,0.5);
 }
});
test('목록 제거·준비 실패·다른 채널 이벤트로 소멸을 만들지 않는다',()=>{
 const currentEffectTimeline = new FieldBattleTimeline();
 for(const currentEventsList of [[],[{...currentEventRecord,effect:'NONE'}],[{...currentEventRecord,channelId:'meadow-2'}]]){
  currentEffectTimeline.synchronizeBattleEvents({...currentStateRecord,mapChatBattleEvents:currentEventsList},0);
  assert.deepEqual(currentEffectTimeline.sampleBattleEffects(0),[]);
 }
 currentEffectTimeline.synchronizeBattleEvents(currentStateRecord,0);
 currentEffectTimeline.synchronizeBattleEvents({...currentStateRecord,channel:{id:'meadow-2'},mapChatBattleEvents:[]},100);
 assert.deepEqual(currentEffectTimeline.sampleBattleEffects(100),[]);
});
test('같은 슬롯의 다음 전투는 다른 이벤트로 재생하고 잘못된 계약은 거절한다',()=>{
 const currentEffectTimeline = new FieldBattleTimeline();
 currentEffectTimeline.synchronizeBattleEvents(currentStateRecord,0);
 currentEffectTimeline.synchronizeBattleEvents({...currentStateRecord,serverTime:110,mapChatBattleEvents:[{...currentEventRecord,eventId:'end-two',battleId:'battle-two',occurredAt:110,expiresAt:112}]},10000);
 assert.equal(currentEffectTimeline.sampleBattleEffects(10000)[0].event.eventId,'end-two');
 assert.throws(()=>currentEffectTimeline.synchronizeBattleEvents({...currentStateRecord,mapChatBattleEvents:[{...currentEventRecord,schemaVersion:2}]},10000),/형식/);
});

const compiledEffectsModule = await build({entryPoints:['src/game/animation/fieldBattleEffects.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':'"file:///test/effects.js"'}});
const {FieldBattleEffectLayer} = await import(`data:text/javascript;base64,${Buffer.from(compiledEffectsModule.outputFiles[0].text).toString('base64')}`);
test('이펙트 레이어는 반복 상태·화면 재작성 후에도 한 개만 유지하고 종료 시 해제한다',()=>{
 const currentEffectLayer = new FieldBattleEffectLayer();
 const currentCreatedImages = [];
 const currentSceneDouble = {add:{image(){
  const currentImageDouble = {scene:true,width:1280,height:1200,
   setData(){return this;},setPosition(){return this;},setDisplaySize(){return this;},setAlpha(currentAlphaValue){this.alpha=currentAlphaValue;return this;},setDepth(){return this;},destroy(){this.scene=false;}};
  currentCreatedImages.push(currentImageDouble);return currentImageDouble;
 }}};
 const currentEffectSamples = [{event:currentEventRecord,progress:0.25}];
 const projectTestPosition = ()=>({x:10,y:20,depth:5});
 currentEffectLayer.renderBattleEffects(currentSceneDouble,currentEffectSamples,projectTestPosition);
 currentEffectLayer.renderBattleEffects(currentSceneDouble,currentEffectSamples,projectTestPosition);
 assert.equal(currentCreatedImages.length,1);
 assert.equal(currentCreatedImages[0].alpha,0.75);
 currentCreatedImages[0].destroy();
 currentEffectLayer.renderBattleEffects(currentSceneDouble,[{event:currentEventRecord,progress:0.75}],projectTestPosition);
 assert.equal(currentCreatedImages.length,2);
 assert.equal(currentCreatedImages[1].alpha,0.25);
 currentEffectLayer.renderBattleEffects(currentSceneDouble,[],projectTestPosition);
 assert.equal(currentCreatedImages.filter(currentImageRecord=>currentImageRecord.scene).length,0);
 currentEffectLayer.clearBattleEffects();
});
