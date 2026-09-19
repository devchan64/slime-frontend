import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/ui/growthCost.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {growthCost}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('능력치와 스킬 비용은 각 분류의 상승 횟수만 반영한다',()=>{
 const attributes={body:3,intellect:2};
 const skills={literacy:1,speaking:0};
 const baselines={literacy:0,speaking:0};
 assert.equal(growthCost('attributes',attributes,skills,baselines).cost,4);
 assert.equal(growthCost('skills',attributes,skills,baselines,'literacy').cost,2);
 assert.equal(growthCost('skills',{body:100},skills,baselines,'literacy').cost,2);
 assert.equal(growthCost('attributes',attributes,{literacy:100}).cost,4);
});
test('신규 레벨 0과 기존 레벨 1 지급 기준을 보존한다',()=>{
 assert.equal(growthCost('skills',{body:1},{literacy:0},{literacy:0},'literacy').cost,1);
 assert.equal(growthCost('skills',{body:1},{literacy:1},{literacy:0},'literacy').cost,2);
 assert.equal(growthCost('skills',{body:1},{literacy:1},{},'literacy').cost,1);
 assert.throws(()=>growthCost('skills',{body:1},{literacy:-1},{literacy:0},'literacy'));
 assert.throws(()=>growthCost('attributes',{body:0},{}));
 assert.equal(growthCost('attributes',{body:1025},{}).label,'262656');
});

test('스킬마다 성장 비용을 독립 계산한다',()=>{
 const skills={literacy:8,speaking:1};
 assert.equal(growthCost('skills',{body:1},skills,{},'literacy').cost,16);
 assert.equal(growthCost('skills',{body:1},skills,{},'speaking').cost,1);
 assert.throws(()=>growthCost('skills',{body:1},skills));
});

test('20단계와 이후에도 완만하게 비용이 증가한다',()=>{
 const expected=[1,2,3,4,6,9,12,16,20,25,30,36,42,49,56,64,72,81,90,100,110,121,132,144];
 expected.forEach((cost,count)=>{assert.equal(growthCost('attributes',{body:count+1},{}).cost,cost);assert.equal(growthCost('skills',{body:1},{literacy:count},{literacy:0},'literacy').cost,cost);});
});
