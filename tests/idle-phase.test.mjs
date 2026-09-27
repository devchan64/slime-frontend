import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const phaseBundleResult=await build({entryPoints:['src/game/animation/idlePhase.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {calculateIdlePhase}=await import(`data:text/javascript;base64,${Buffer.from(phaseBundleResult.outputFiles[0].text).toString('base64')}`);
test('개체 ID별 시차는 재생 주기 안에 있으며 재생성해도 유지된다',()=>{
 for(const cycleDurationValue of [1000,1600]) {
  const recordedPhaseValues=Array.from({length:100},(_,actorSequenceNumber)=>calculateIdlePhase(`monster:meadow-slime-${actorSequenceNumber}`,cycleDurationValue));
  assert.ok(recordedPhaseValues.every(phaseOffsetValue=>phaseOffsetValue>=0&&phaseOffsetValue<cycleDurationValue));
  assert.deepEqual(recordedPhaseValues,Array.from({length:100},(_,actorSequenceNumber)=>calculateIdlePhase(`monster:meadow-slime-${actorSequenceNumber}`,cycleDurationValue)));
  assert.ok(new Set(recordedPhaseValues.slice(0,5).map(phaseOffsetValue=>Math.floor(phaseOffsetValue/(cycleDurationValue/4)))).size>1);
 }
});
test('개체 ID와 반복 시간의 잘못된 입력을 거절한다',()=>{
 for(const cycleDurationValue of [0,-1,NaN,Infinity,1.5])assert.throws(()=>calculateIdlePhase('monster:one',cycleDurationValue));
 assert.throws(()=>calculateIdlePhase(' ',1000));
});
