import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/healthDisplay.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {healthDisplay}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const enemy=(hp,maxHp=100,healthVisibility)=>({hp,maxHp,side:'enemy',healthVisibility});
test('무스킬은 모든 생존 HP에서 같은 미확인 정보만 공개한다',()=>{
 const values=[1,49,50,51,99,100].map(hp=>healthDisplay(enemy(hp),0));
 for(const value of values) assert.deepEqual(value,{ratio:null,labelKey:'battle.healthHidden'});
 assert.deepEqual(healthDisplay(enemy(0),0),{ratio:null,labelKey:'battle.healthFallen'});
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

test('양쪽 언어팩은 적의 실제 HP 치환 없이 공개 수준만 번역한다', async()=>{
 const {readFileSync}=await import('node:fs');
 const {parsePack,formatMessage}=await import('../src/i18n/catalog.mjs');
 for(const locale of ['ko','en']) {
  const pack=parsePack(readFileSync(`src/i18n/locales/${locale}/battle.yaml`,'utf8'),locale);
  for(const lore of [0,1]) for(const hp of [0,17,83]) {
   const display=healthDisplay(enemy(hp),lore);
   assert.equal(display.values,undefined);
   const label=formatMessage(pack[display.labelKey.split('.')[1]],display.values);
   assert.ok(label.length>0);
   assert.ok(!/17|83|100/.test(label));
  }
  const ally=healthDisplay({hp:17,maxHp:100,side:'ally'},0);
  assert.equal(formatMessage(pack[ally.labelKey.split('.')[1]],ally.values),'HP 17 / 100');
 }
});

test('공개 전장 미리보기의 적은 내부 능력치를 포함하지 않는다',async()=>{
 const {readFile}=await import('node:fs/promises');
 const states=JSON.parse(await readFile('src/dev/battlefield-fixtures.json','utf8'));
 for(const state of states)for(const unit of state.battle.units){
  if(unit.side==='enemy')for(const key of ['attack','defense','speed','move','range','ap','maxAp','basicAttackAvailable'])
   assert.equal(key in unit,false,`${unit.id}: ${key}`);
  else assert.ok(Array.isArray(unit.range));
 }
});
