import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const compiledBoardModule = await build({entryPoints:['src/game/animation/boardAnimation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {createBoardActorAnimation} = await import(`data:text/javascript;base64,${Buffer.from(compiledBoardModule.outputFiles[0].text).toString('base64')}`);
const sourceAssetRecord = JSON.parse(await readFile('tests/fixtures/cell-animation-v2.json','utf8'));
test('8fps 프레임 경계와 루프를 적용하고 원본은 변경하지 않는다',()=>{
 const sourceAnimationMetadata = structuredClone(sourceAssetRecord.animation);
 const originalAnimationSnapshot = structuredClone(sourceAnimationMetadata);
 const boardActorAnimation = createBoardActorAnimation(sourceAnimationMetadata);
 const selectedLoopClip = boardActorAnimation.data.clips.find(currentAnimationClip => currentAnimationClip.loop && currentAnimationClip.frames.length > 1);
 assert.ok(selectedLoopClip);
 assert.equal(boardActorAnimation.sample(selectedLoopClip.clipId,124).frame.frameId,selectedLoopClip.frames[0].frameId);
 assert.equal(boardActorAnimation.sample(selectedLoopClip.clipId,125).frame.frameId,selectedLoopClip.frames[1].frameId);
 assert.equal(boardActorAnimation.sample(selectedLoopClip.clipId,selectedLoopClip.frames.length*125).frame.frameId,selectedLoopClip.frames[0].frameId);
 assert.deepEqual(sourceAnimationMetadata,originalAnimationSnapshot);
 for(const currentAnimationClip of boardActorAnimation.data.clips) assert.ok(currentAnimationClip.frames.every(currentFrameRecord=>currentFrameRecord.durationMs===125));
});
