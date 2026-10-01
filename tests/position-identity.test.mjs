import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBundleResult=await build({entryPoints:['src/client/positionIdentity.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {createPositionIdentity}=await import(`data:text/javascript;base64,${Buffer.from(currentBundleResult.outputFiles[0].text).toString('base64')}`);
test('위치 문맥은 JSON 필드 순서를 무시하고 실제 좌표 변경은 구분한다',()=>{
 assert.equal(createPositionIdentity({column:1,row:2}),createPositionIdentity({row:2,column:1}));
 assert.notEqual(createPositionIdentity({column:1,row:2}),createPositionIdentity({column:2,row:1}));
 assert.notEqual(createPositionIdentity({column:1,row:2}),createPositionIdentity({column:1,row:3}));
 assert.notEqual(createPositionIdentity({column:0,row:0}),createPositionIdentity(undefined));
 assert.equal(createPositionIdentity(null),createPositionIdentity(undefined));
});
