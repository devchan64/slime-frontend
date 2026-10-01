import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/substituteHuntCommand.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {getSubstituteHuntCommand}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function buildHuntTestClient(){
 const currentRequestCalls=[];
 const currentGameClient={tokens:{user_id:'actor'},state:{generation:1,me:{id:'actor',version:3}},accept(currentNewState){this.state=currentNewState;},async request(currentRequestPath,currentRequestBody){
  currentRequestCalls.push({path:currentRequestPath,body:currentRequestBody});
  if(currentRequestBody)return {ok:true,kind:'substitute_hunt',requestId:currentRequestBody.requestId,substituteHunt:{policyVersion:1,encounterId:'passive',encounterCatalogVersion:1,speciesId:'slime',monsterReferenceVersion:2,csp:8,enemyCount:2,fpCost:16,dropCatalogVersion:2,dissectionPolicyVersion:1,materials:[],fpConsumed:16,fpRemaining:34,characterVersion:4}};
  return {generation:1,me:{id:'actor',version:4}};
 }};
 return {currentGameClient,currentRequestCalls};
}
test('동시 실행은 한 번 전송하며 최신 스냅샷을 반영한다',async()=>{
 const {currentGameClient,currentRequestCalls}=buildHuntTestClient();const currentHuntController=getSubstituteHuntCommand(currentGameClient);
 const currentResults=await Promise.all([currentHuntController.executeHuntCommand('passive',3),currentHuntController.executeHuntCommand('passive',3)]);
 assert.deepEqual(currentResults[0],currentResults[1]);assert.equal(currentRequestCalls.filter(currentCall=>currentCall.body).length,1);assert.equal(currentGameClient.state.me.version,4);assert.equal(currentHuntController.pendingHuntRequest,null);
});
test('응답 유실은 메뉴 재진입 뒤에도 최초 ID와 버전으로 재시도한다',async()=>{
 const {currentGameClient,currentRequestCalls}=buildHuntTestClient();const currentOriginalRequest=currentGameClient.request.bind(currentGameClient);let currentShouldFail=true;
 currentGameClient.request=async(...currentRequestArguments)=>{const currentResponse=await currentOriginalRequest(...currentRequestArguments);if(currentShouldFail){currentShouldFail=false;throw new Error('응답 유실');}return currentResponse;};
 const currentHuntController=getSubstituteHuntCommand(currentGameClient);await assert.rejects(currentHuntController.executeHuntCommand('passive',3));
 assert.equal(getSubstituteHuntCommand(currentGameClient),currentHuntController);
 await assert.rejects(currentHuntController.executeHuntCommand('aggro',99));
 await currentHuntController.executeHuntCommand('passive',99);
 const currentPostCalls=currentRequestCalls.filter(currentCall=>currentCall.body);assert.equal(currentPostCalls.length,2);assert.deepEqual(currentPostCalls[0].body,currentPostCalls[1].body);assert.equal(currentPostCalls[1].body.expectedVersion,3);
});
test('지급 성공 후 스냅샷 오류는 지급 재전송 없이 복구한다',async()=>{
 const {currentGameClient,currentRequestCalls}=buildHuntTestClient();const currentOriginalRequest=currentGameClient.request.bind(currentGameClient);let currentShouldFail=true;
 currentGameClient.request=async(...currentRequestArguments)=>{if(!currentRequestArguments[1]&&currentShouldFail){currentShouldFail=false;throw new Error('스냅샷 오류');}return currentOriginalRequest(...currentRequestArguments);};
 const currentHuntController=getSubstituteHuntCommand(currentGameClient);await assert.rejects(currentHuntController.executeHuntCommand('passive',3));await currentHuntController.executeHuntCommand('passive',3);
 assert.equal(currentRequestCalls.filter(currentCall=>currentCall.body).length,1);
});
test('세션이 바뀌면 이전 결과로 새 캐릭터 상태를 덮지 않는다',async()=>{
 const {currentGameClient}=buildHuntTestClient();const currentOriginalRequest=currentGameClient.request.bind(currentGameClient);
 currentGameClient.request=async(...currentRequestArguments)=>{const currentResponse=await currentOriginalRequest(...currentRequestArguments);if(!currentRequestArguments[1])currentGameClient.state={generation:2,me:{id:'other',version:0}};return currentResponse;};
 const currentHuntController=getSubstituteHuntCommand(currentGameClient);await assert.rejects(currentHuntController.executeHuntCommand('passive',3));assert.equal(currentGameClient.state.me.id,'other');assert.notEqual(getSubstituteHuntCommand(currentGameClient),currentHuntController);
});
