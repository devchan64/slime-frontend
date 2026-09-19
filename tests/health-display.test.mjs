import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/healthDisplay.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {healthDisplayRatio}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('추정 체력은 같은 구간에서 고정되며 아군 체력은 정확하게 표시한다',()=>{
 assert.equal(healthDisplayRatio(51,100,false),healthDisplayRatio(74,100,false));
 assert.equal(healthDisplayRatio(1,100,false),.25);
 assert.equal(healthDisplayRatio(0,100,false),0);
 assert.equal(healthDisplayRatio(100,100,false),1);
 assert.equal(healthDisplayRatio(51,100,true),.51);
 assert.throws(()=>healthDisplayRatio(1,0,false));
});
