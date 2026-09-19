import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles} = await build({entryPoints:['src/ui/battleSelection.ts'], bundle:true, write:false, format:'esm', platform:'node'});
const {defaultBattleMode, singleAttackTarget} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const makeBattle = () => ({status:'ACTIVE', order:['hero'], index:0, moved:false, acted:false,
 tactics:{canAct:true, moves:[{position:{column:1,row:1}}], attacks:[{targetId:'slime',damage:3}]},
 units:[{id:'slime',hp:10,position:{column:2,row:1}}]});
test('이동을 기본 선택하고 이동 완료 후 공격 대상이 있으면 공격으로 전환한다', () => {
 const b=makeBattle();
 assert.equal(defaultBattleMode(b,'hero',30),'MOVE');
 b.moved=true;
 assert.equal(defaultBattleMode(b,'hero',30),'ATTACK');
 assert.deepEqual(singleAttackTarget(b),{column:2,row:1});
 b.tactics.attacks=[];
 assert.equal(defaultBattleMode(b,'hero',30),null);
});
test('공격 후에는 남은 이동만 선택하고 권한 없는 턴에는 선택하지 않는다', () => {
 const b=makeBattle(); b.acted=true;
 assert.equal(defaultBattleMode(b,'hero',30),'MOVE');
 assert.equal(singleAttackTarget(b),null);
 b.moved=true;
 assert.equal(defaultBattleMode(b,'hero',30),null);
 for(const [actor,time] of [['other',30],['hero',0]]) assert.equal(defaultBattleMode(makeBattle(),actor,time),null);
 const preparing=makeBattle(); preparing.status='PREPARING';
 assert.equal(defaultBattleMode(preparing,'hero',30),null);
 const blocked=makeBattle(); blocked.tactics.canAct=false;
 assert.equal(defaultBattleMode(blocked,'hero',30),null);
});
test('복수 후보나 사망 대상은 자동 선택하지 않는다', () => {
 const b=makeBattle(); b.tactics.attacks.push({targetId:'beast',damage:3});
 assert.equal(singleAttackTarget(b),null);
 b.tactics.attacks.pop(); b.units[0].hp=0;
 assert.equal(singleAttackTarget(b),null);
});

test('AP 전투는 사용 이력보다 서버 잔고 미리보기를 따르고 이동 후 공격을 우선한다',()=>{
 const b={rulesVersion:'1.4.0',status:'ACTIVE',tactics:{canAct:true,moves:[{}],attacks:[{targetId:'e'}]},order:['a'],index:0,moved:true,acted:true,units:[{id:'e',hp:1,position:{column:2,row:2}}]};
 assert.equal(defaultBattleMode(b,'a',30),'ATTACK');
 assert.deepEqual(singleAttackTarget(b),{column:2,row:2});
 assert.equal(defaultBattleMode({...b,tactics:{...b.tactics,attacks:[]}},'a',30),'MOVE');
 assert.equal(defaultBattleMode({...b,tactics:{canAct:true,moves:[],attacks:[]}},'a',30),null);
});
