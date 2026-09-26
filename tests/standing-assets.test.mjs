import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const standingModulePath = pathToFileURL(resolve('src/game/animation/standingActors.ts')).href;
const standingBundleOutput = await build({entryPoints:['src/game/animation/standingActors.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(standingModulePath)}});
const {ACTOR_STANDING_ASSETS,ACTOR_STANDING_TEXTURES,DEFAULT_STANDING_DIRECTION_ASSETS,resolveActorStandingAsset,updateActorStandingFrame} = await import(`data:text/javascript;base64,${Buffer.from(standingBundleOutput.outputFiles[0].text).toString('base64')}`);

test('캐릭터 스탠딩·휴식과 몬스터 10종의 등록 파일·관리 ID가 중복되지 않는다',()=>{
 const registeredStandingAssets=Object.values(ACTOR_STANDING_ASSETS);
 assert.equal(registeredStandingAssets.length,12);
 assert.equal(new Set(registeredStandingAssets.map(standingAssetRecord=>standingAssetRecord.key)).size,12);
 assert.equal(new Set(registeredStandingAssets.map(standingAssetRecord=>standingAssetRecord.animation.data.animationId)).size,12);
 for(const standingAssetRecord of registeredStandingAssets) assert.ok(existsSync(new URL(standingAssetRecord.url)));
});
test('등록된 모든 방향은 지정된 시간 경계에서 프레임을 전환하고 반복한다',()=>{
 for(const standingAssetRecord of Object.values(ACTOR_STANDING_ASSETS)) {
  for(const standingClipRecord of standingAssetRecord.animation.data.clips) {
   let accumulatedFrameTime=0;
   for(const standingFrameRecord of standingClipRecord.frames) {
    assert.equal(standingAssetRecord.animation.sample(standingClipRecord.clipId,accumulatedFrameTime).frame.frameId,standingFrameRecord.frameId);
    accumulatedFrameTime+=standingFrameRecord.durationMs;
   }
   assert.equal(standingClipRecord.loop,true);
   assert.equal(standingAssetRecord.animation.sample(standingClipRecord.clipId,accumulatedFrameTime).frame.frameId,standingClipRecord.frames[0].frameId);
  }
 }
});

test('첫 프레임이 이미 선택되어 있어도 발 기준점을 적용한다',()=>{
 const humanStandingAsset=ACTOR_STANDING_ASSETS.human;
 const initialStandingFrame=humanStandingAsset.animation.data.frames[0];
 const renderedCharacterImage={
  scene:{time:{now:0}}, frame:{name:`cell:${humanStandingAsset.animation.data.animationId}@${humanStandingAsset.animation.data.version}:${initialStandingFrame.frameId}`},
  originX:0.5,originY:0.5,
  getData(standingDataKey){return standingDataKey==='actorStandingKind'?'human':0;},
  setTexture(){throw new Error('동일 프레임은 다시 로드하지 않는다.');},
  setOrigin(selectedFrameOriginX,selectedFrameOriginY){this.originX=selectedFrameOriginX;this.originY=selectedFrameOriginY;return this;},
 };
 updateActorStandingFrame(renderedCharacterImage,'down_left');
 assert.equal(renderedCharacterImage.originX,initialStandingFrame.anchor.x/initialStandingFrame.rect.width);
 assert.equal(renderedCharacterImage.originY,initialStandingFrame.anchor.y/initialStandingFrame.rect.height);
});

test('네 방향 텍스처가 모두 로드 대상이고 방향 전환 시 올바른 시트를 사용한다',()=>{
 assert.equal(ACTOR_STANDING_TEXTURES.length,15);
 assert.equal(new Set(ACTOR_STANDING_TEXTURES.map(currentAssetRecord=>currentAssetRecord.key)).size,15);
 const renderedCharacterImage={scene:{time:{now:0}},frame:{name:''},originX:0,originY:0,
  getData(currentDataName){return currentDataName==='actorStandingKind'?'human':0;},
  setTexture(currentTextureKey,currentFrameName){this.textureKey=currentTextureKey;this.frame.name=currentFrameName;return this;},
  setOrigin(currentOriginValueX,currentOriginValueY){this.originX=currentOriginValueX;this.originY=currentOriginValueY;return this;}};
 for(const [currentDirectionName,currentDirectionAsset] of Object.entries(DEFAULT_STANDING_DIRECTION_ASSETS)) {
  assert.ok(existsSync(new URL(currentDirectionAsset.url)));
  for(const currentFrameTime of [0,250,750,1750,2000]) {
   renderedCharacterImage.scene.time.now=currentFrameTime;
   updateActorStandingFrame(renderedCharacterImage,currentDirectionName);
   assert.equal(renderedCharacterImage.textureKey,currentDirectionAsset.key);
   assert.match(renderedCharacterImage.frame.name,new RegExp(`${currentDirectionName}\\.${(currentFrameTime/250)%8}$`));
  }
 }
 assert.throws(()=>resolveActorStandingAsset('human','invalid'));
});
test('교체된 대기 에셋은 32프레임과 셀 내부 앵커·출처를 갖는다',()=>{
 const currentSourceMetadata=JSON.parse(readFileSync('src/assets/characters/default/standing-v5/source.json','utf8'));
 assert.equal(currentSourceMetadata.generationId,'2026-09-26_11-42-00-59d460b0');
 assert.equal(currentSourceMetadata.gameBodyHeight,80);
 assert.equal(ACTOR_STANDING_ASSETS.human.animation.data.frames.length,32);
 for(const currentFrameRecord of ACTOR_STANDING_ASSETS.human.animation.data.frames){
  assert.ok(currentFrameRecord.anchor.x>=0&&currentFrameRecord.anchor.x<512);
  assert.ok(currentFrameRecord.anchor.y>=0&&currentFrameRecord.anchor.y<512);
  assert.ok(currentSourceMetadata.frames.some(currentSourceFrame=>currentSourceFrame.frameId===currentFrameRecord.frameId));
 }
 assert.equal(existsSync('src/assets/characters/default/standing-v4'),false);
});
