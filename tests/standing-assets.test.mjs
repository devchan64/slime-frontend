import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const standingModulePath = pathToFileURL(resolve('src/game/animation/standingActors.ts')).href;
const standingBundleOutput = await build({entryPoints:['src/game/animation/standingActors.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(standingModulePath)}});
const {ACTOR_STANDING_ASSETS} = await import(`data:text/javascript;base64,${Buffer.from(standingBundleOutput.outputFiles[0].text).toString('base64')}`);

test('캐릭터와 몬스터 10종의 등록 파일·관리 ID가 중복되지 않는다',()=>{
 const registeredStandingAssets=Object.values(ACTOR_STANDING_ASSETS);
 assert.equal(registeredStandingAssets.length,11);
 assert.equal(new Set(registeredStandingAssets.map(standingAssetRecord=>standingAssetRecord.key)).size,11);
 assert.equal(new Set(registeredStandingAssets.map(standingAssetRecord=>standingAssetRecord.animation.data.animationId)).size,11);
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
