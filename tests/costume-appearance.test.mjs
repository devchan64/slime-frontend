import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild=await build({entryPoints:['src/client/costumeAppearance.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {resolveCostumeActorKind,validateSceneCostumeReferences}=await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
const DEFAULT_COSTUME_REFERENCE={costumeId:'default',costumeVersion:1,designId:'default',designVersion:1};
test('과거 누락 참조와 기본 전체 디자인만 승인된 렌더링 묶음으로 연결한다',()=>{
 assert.equal(resolveCostumeActorKind(undefined),'human');
 assert.equal(resolveCostumeActorKind(DEFAULT_COSTUME_REFERENCE),'human');
 for(const currentInvalidReference of [null,{}, {...DEFAULT_COSTUME_REFERENCE,designVersion:2},{...DEFAULT_COSTUME_REFERENCE,designId:'unknown'},{...DEFAULT_COSTUME_REFERENCE,designVersion:true},{...DEFAULT_COSTUME_REFERENCE,hairId:'hair'}])assert.throws(()=>resolveCostumeActorKind(currentInvalidReference));
});
test('본인·근처 캐릭터·전투 아군의 미지원 외형을 그리기 전에 거절한다',()=>{
 const currentSceneState={me:{},members:[{}],battle:{units:[{side:'ally'},{side:'enemy',costumeAppearance:null}]}};
 assert.doesNotThrow(()=>validateSceneCostumeReferences(currentSceneState));
 for(const currentTargetPath of ['me','member','ally']){
  const currentChangedState=structuredClone(currentSceneState);
  const currentTargetRecord=currentTargetPath==='me'?currentChangedState.me:currentTargetPath==='member'?currentChangedState.members[0]:currentChangedState.battle.units[0];
  currentTargetRecord.costumeAppearance={...DEFAULT_COSTUME_REFERENCE,designId:'unregistered'};
  assert.throws(()=>validateSceneCostumeReferences(currentChangedState));
 }
});
