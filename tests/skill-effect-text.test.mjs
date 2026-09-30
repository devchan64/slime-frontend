import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles:currentBundledFiles}=await build({entryPoints:['src/client/skillEffectText.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {formatSkillEffectPreview}=await import(`data:text/javascript;base64,${Buffer.from(currentBundledFiles[0].text).toString('base64')}`);
const translateEffectMessage=(currentMessageKey,currentMessageValues)=>currentMessageKey+':'+Object.values(currentMessageValues).join(',');
test('공격·회복·포식 효과를 구분한다',()=>{
 assert.equal(formatSkillEffectPreview({damage:8},translateEffectMessage),'battle.expectedDamage:8');
 assert.equal(formatSkillEffectPreview({damage:0,healing:16},translateEffectMessage),'battle.expectedHealing:16');
 assert.equal(formatSkillEffectPreview({damage:22,drainHealing:5},translateEffectMessage),'battle.expectedDamage:22 · battle.expectedDrain:5');
 assert.throws(()=>formatSkillEffectPreview({damage:0,healing:-1},translateEffectMessage));
});
