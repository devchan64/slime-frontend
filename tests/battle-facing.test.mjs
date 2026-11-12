import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledFacingModule = await build({stdin:{contents:`export * from './src/game/animation/facing';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {screenFacing,shouldMirrorActorSprite,resolveActorSpriteMirror,resolveActorArtworkDirection} = await import(`data:text/javascript;base64,${Buffer.from(compiledFacingModule.outputFiles[0].text).toString('base64')}`);
const supportedWorldFacings = ['column_positive','column_negative','row_positive','row_negative'];
test('모든 논리 이동 방향과 맵 회전에서 정면왼쪽 클립을 선택한다',()=>{
 for (const actorWorldFacing of supportedWorldFacings) for (const currentMapRotation of [0,1,2,3]) {
  assert.equal(screenFacing(actorWorldFacing,currentMapRotation),'down_left');
 }
});
test('단일 방향 표시에서도 잘못된 논리 방향과 맵 회전은 거절한다',()=>{
 for(const invalidWorldFacing of ['unknown','toString',null,undefined]) assert.throws(()=>screenFacing(invalidWorldFacing,0));
 for(const invalidMapRotation of [-1,4,NaN,true,.5]) assert.throws(()=>screenFacing('row_positive',invalidMapRotation));
});

test('맵 회전 후 화면 좌우에 따라 반전하고 반대 방향은 반대 상태를 가진다',()=>{
 const expectedMirrorStates = {
  column_positive:[true,false,false,true],
  column_negative:[false,true,true,false],
  row_positive:[false,false,true,true],
  row_negative:[true,true,false,false],
 };
 for (const [actorWorldFacing,expectedRotationStates] of Object.entries(expectedMirrorStates)) {
  expectedRotationStates.forEach((expectedMirrorFlag,currentMapRotation)=>assert.equal(shouldMirrorActorSprite(actorWorldFacing,currentMapRotation),expectedMirrorFlag));
 }
 assert.throws(()=>shouldMirrorActorSprite('unknown',0));
 assert.throws(()=>shouldMirrorActorSprite('column_positive',4));
});

test('오른쪽 앞 걷기는 모든 회전에서 왼쪽 앞 대기와 반대 반전을 사용한다',()=>{
 for(const actorWorldFacing of supportedWorldFacings) for(const currentMapRotation of [0,1,2,3]) {
  assert.equal(shouldMirrorActorSprite(actorWorldFacing,currentMapRotation,'down_right'),!shouldMirrorActorSprite(actorWorldFacing,currentMapRotation,'down_left'));
 }
});

test('캐릭터 기본 방향은 오른쪽 앞이며 몬스터 기본 방향은 유지한다',()=>{
 for(const actorWorldFacing of supportedWorldFacings) for(const currentMapRotation of [0,1,2,3]) {
  assert.equal(screenFacing(actorWorldFacing,currentMapRotation,'down_right'),'down_right');
  assert.equal(screenFacing(actorWorldFacing,currentMapRotation,'down_left'),'down_left');
 }
 assert.throws(()=>screenFacing('row_positive',0,'invalid'));
});

test('방향 없는 캐릭터는 대기와 오른쪽 앞 휴식 전환에서 오른쪽을 유지한다',()=>{
 for(const currentMapRotation of [0,1,2,3]) {
  assert.equal(resolveActorSpriteMirror(undefined,currentMapRotation,'down_left',true),true);
  assert.equal(resolveActorSpriteMirror(undefined,currentMapRotation,'down_right',true),false);
  assert.equal(resolveActorSpriteMirror(undefined,currentMapRotation,'down_left',false),false);
  for(const actorWorldFacing of supportedWorldFacings) for(const spriteBaseDirection of ['down_left','down_right'])
   assert.equal(resolveActorSpriteMirror(actorWorldFacing,currentMapRotation,spriteBaseDirection,true),shouldMirrorActorSprite(actorWorldFacing,currentMapRotation,spriteBaseDirection));
 }
});

test('서버의 캐릭터 기본 column_positive는 기본 회전에서 오른쪽을 향한다',()=>{
 assert.equal(resolveActorSpriteMirror('column_positive',0,'down_right',true),false);
 assert.equal(resolveActorSpriteMirror('column_positive',0,'down_left',true),true);
 assert.equal(resolveActorSpriteMirror('row_positive',0,'down_right',true),true);
});

test('오른쪽 이동 완료 후 대기·휴식도 마지막 방향을 유지한다',()=>{
 for(const currentActorKind of ['human','human-rest']) {
  const currentArtworkDirection=resolveActorArtworkDirection(currentActorKind);
  assert.equal(currentArtworkDirection,'down_right');
  assert.equal(resolveActorSpriteMirror('column_positive',0,currentArtworkDirection,true),false);
  assert.equal(resolveActorSpriteMirror('row_positive',0,currentArtworkDirection,true),true);
 }
 assert.equal(resolveActorArtworkDirection('slime'),'down_left');
});
