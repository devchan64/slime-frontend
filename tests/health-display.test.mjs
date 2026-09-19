import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/healthDisplay.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {healthDisplay}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const enemy=(hp,maxHp=100,healthVisibility)=>({hp,maxHp,side:'enemy',healthVisibility});
test('무스킬은 모든 생존 HP에서 같은 미확인 정보만 공개한다',()=>{
 const values=[1,49,50,51,99,100].map(hp=>healthDisplay(enemy(hp),0));
 for(const value of values) assert.deepEqual(value,{ratio:null,label:'체력 미확인 · 몬스터학 필요'});
 assert.deepEqual(healthDisplay(enemy(0),0),{ratio:null,label:'쓰러짐'});
});
test('몬스터학 1레벨은 50% 경계의 두 단계만 표시한다',()=>{
 for(const hp of [1,49,50]) assert.equal(healthDisplay(enemy(hp),1).ratio,.5);
 for(const hp of [51,99,100]) assert.equal(healthDisplay(enemy(hp),1).ratio,1);
 assert.equal(healthDisplay(enemy(1,2,'BANDED'),1).ratio,.5);
 assert.equal(healthDisplay(enemy(2,2,'BANDED'),1).ratio,1);
 assert.equal(healthDisplay(enemy(1),5).ratio,.5);
});
test('서버 비공개는 스킬 보유 주장으로 복원하지 않으며 아군은 정확하게 표시한다',()=>{
 assert.equal(healthDisplay(enemy(1,1,'HIDDEN'),1).ratio,null);
 assert.equal(healthDisplay({...enemy(51),side:'ally'},0).ratio,.51);
 assert.throws(()=>healthDisplay(enemy(1,0),0));
 assert.throws(()=>healthDisplay(enemy(1),-1));
 assert.throws(()=>healthDisplay(enemy(1,1,'EXACT'),1));
});
