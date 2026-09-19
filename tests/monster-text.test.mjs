import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({entryPoints:['src/client/monsterText.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { localizedMonsters, localizedMonster } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('필드·전투 이름 전환은 원본과 아군 이름 및 전투 수치를 보존한다', () => {
  const monster = {id:'slime',name:'슬라임',nameTranslations:{ko:'슬라임',en:'Slime'},position:{column:1,row:2}};
  const ally = {side:'ally',name:'내 이름',nameTranslations:{ko:'무시',en:'Ignored'}};
  const enemy = {...monster,side:'enemy',hp:1,maxHp:2,healthVisibility:'BANDED',nameTranslations:{ko:'슬라임 1',en:'Slime 1'},name:'슬라임 1'};
  const state = {monsters:[monster],battle:{units:[ally,enemy],log:[{targetId:'slime'}]}};
  const copy = structuredClone(state);
  const en = localizedMonsters(state,'en');
  assert.equal(en.monsters[0].name,'Slime');
  assert.equal(en.battle.units[1].name,'Slime 1');
  assert.equal(en.battle.units[0],ally);
  assert.equal(en.battle.units[1].hp,1);
  assert.equal(en.battle.units[1].maxHp,2);
  assert.equal(en.battle.log,state.battle.log);
  assert.deepEqual(state,copy);
  assert.deepEqual(localizedMonsters(en,'ko'),state);
  assert.equal(localizedMonster({name:'기존 몬스터'},'en').name,'기존 몬스터');
});
test('불완전한 새 번역은 거절한다', () => {
  for (const nameTranslations of [null,{}, {ko:'이름'}, {ko:'이름',en:' '}, {ko:'이름',en:'Name',ja:'名前'}])
    assert.throws(()=>localizedMonster({name:'이름',nameTranslations},'en'));
});
