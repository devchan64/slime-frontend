import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/growthCost.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {growthCost}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('능력치와 스킬 비용은 각 분류의 상승 횟수만 반영한다',()=>{
 const attributes={body:3,intellect:2};
 const skills={literacy:1,speaking:0};
 const baselines={literacy:0,speaking:0};
 assert.equal(growthCost('attributes',attributes,skills,baselines).cost,8);
 assert.equal(growthCost('skills',attributes,skills,baselines).cost,2);
 assert.equal(growthCost('skills',{body:100},skills,baselines).cost,2);
 assert.equal(growthCost('attributes',attributes,{literacy:100}).cost,8);
});
test('신규 레벨 0과 기존 레벨 1 지급 기준을 보존한다',()=>{
 assert.equal(growthCost('skills',{body:1},{literacy:0},{literacy:0}).cost,1);
 assert.equal(growthCost('skills',{body:1},{literacy:1},{literacy:0}).cost,2);
 assert.equal(growthCost('skills',{body:1},{literacy:1}).cost,1);
 assert.throws(()=>growthCost('skills',{body:1},{literacy:-1},{literacy:0}));
 assert.throws(()=>growthCost('attributes',{body:0},{}));
 assert.equal(growthCost('attributes',{body:1025},{}).label,'2^1024');
});
