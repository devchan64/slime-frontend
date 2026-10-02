import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/facilitySessionContext.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {captureFacilitySessionContext,matchesFacilitySessionContext}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function createFacilityTestClient(){return {tokens:{user_id:'owner'},state:{generation:1,epoch:1,cursor:1,map:{id:'city'},location:{id:'channel'},me:{id:'character',mode:'FIELD',battleId:null,version:1,position:{column:1,row:2}}}};}
for(const [currentCaseName,currentSessionMutation] of Object.entries({
  owner:currentClient=>{currentClient.tokens.user_id='other';},
  generation:currentClient=>{currentClient.state.generation++;},
  epoch:currentClient=>{currentClient.state.epoch++;},
  character:currentClient=>{currentClient.state.me.id='other';},
  map:currentClient=>{currentClient.state.map.id='other';},
  channel:currentClient=>{currentClient.state.location.id='other';},
  position:currentClient=>{currentClient.state.me.position.column++;},
  mode:currentClient=>{currentClient.state.me.mode='BATTLE';},
  battleId:currentClient=>{currentClient.state.me.battleId='battle';},
  battle:currentClient=>{currentClient.state.battle={id:'battle'};},
  reservation:currentClient=>{currentClient.state.reservation={id:'reservation'};},
  logout:currentClient=>{currentClient.tokens=null;},
  missingState:currentClient=>{currentClient.state=null;},
}))test('현장 요청 이후 변경 거절: '+currentCaseName,()=>{
  const currentSessionClient=createFacilityTestClient();
  const currentCapturedContext=captureFacilitySessionContext(currentSessionClient);
  currentSessionMutation(currentSessionClient);
  assert.equal(matchesFacilitySessionContext(currentSessionClient,currentCapturedContext),false);
});
test('같은 현장의 버전·커서 갱신과 위치 객체 교체는 세션 변경이 아니다',()=>{
  const currentSessionClient=createFacilityTestClient();
  const currentCapturedContext=captureFacilitySessionContext(currentSessionClient);
  currentSessionClient.state.me.version++;currentSessionClient.state.cursor++;
  currentSessionClient.state.me.position={column:1,row:2};
  assert.equal(matchesFacilitySessionContext(currentSessionClient,currentCapturedContext),true);
});
