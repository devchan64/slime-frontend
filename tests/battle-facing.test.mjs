import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledFacingModule = await build({stdin:{contents:`export * from './src/game/animation/facing';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {screenFacing} = await import(`data:text/javascript;base64,${Buffer.from(compiledFacingModule.outputFiles[0].text).toString('base64')}`);
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
