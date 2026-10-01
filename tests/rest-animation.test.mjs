import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const restModuleBundle = await build({entryPoints:['src/game/animation/fieldRestAnimation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {FieldRestAnimation} = await import(`data:text/javascript;base64,${Buffer.from(restModuleBundle.outputFiles[0].text).toString('base64')}`);
const actorStableIdentifier = 'member:test';
const currentActorStates = restingActiveFlag => [{actorStableIdentifier,restingActiveFlag}];
test('휴식 진입은 상태 재수신에도 재시작하지 않고 앉은 상태 시간을 유지한다',()=>{
 const restPlaybackController = new FieldRestAnimation();
 restPlaybackController.syncRestAnimations(currentActorStates(false),0);
 assert.equal(restPlaybackController.sampleRestAnimation(actorStableIdentifier,0,1000),null);
 restPlaybackController.syncRestAnimations(currentActorStates(true),100);
 assert.deepEqual(restPlaybackController.sampleRestAnimation(actorStableIdentifier,100,1000),{actionNameValue:'rest-entry',elapsedTimeValue:0});
 restPlaybackController.syncRestAnimations(currentActorStates(true),900);
 assert.deepEqual(restPlaybackController.sampleRestAnimation(actorStableIdentifier,10000,1000),{actionNameValue:'rest-entry',elapsedTimeValue:9900});
});
test('해제는 8프레임의 1000ms를 완료한 후 대기로 돌아간다',()=>{
 const restPlaybackController = new FieldRestAnimation();
 restPlaybackController.syncRestAnimations(currentActorStates(true),0);
 restPlaybackController.syncRestAnimations(currentActorStates(false),2000);
 restPlaybackController.syncRestAnimations(currentActorStates(false),2500);
 assert.deepEqual(restPlaybackController.sampleRestAnimation(actorStableIdentifier,2999,1000),{actionNameValue:'rest-exit',elapsedTimeValue:999});
 assert.equal(restPlaybackController.sampleRestAnimation(actorStableIdentifier,3000,1000),null);
 restPlaybackController.syncRestAnimations(currentActorStates(true),4000);
 assert.deepEqual(restPlaybackController.sampleRestAnimation(actorStableIdentifier,4000,1000),{actionNameValue:'rest-entry',elapsedTimeValue:0});
});
test('제거된 개체와 장면 종료의 휴식 재생 상태를 정리한다',()=>{
 const restPlaybackController = new FieldRestAnimation();
 restPlaybackController.syncRestAnimations(currentActorStates(true),0);
 restPlaybackController.syncRestAnimations([],100);
 assert.equal(restPlaybackController.sampleRestAnimation(actorStableIdentifier,100,1000),null);
 restPlaybackController.syncRestAnimations(currentActorStates(true),200);
 restPlaybackController.resetRestAnimations();
 assert.equal(restPlaybackController.sampleRestAnimation(actorStableIdentifier,300,1000),null);
});
