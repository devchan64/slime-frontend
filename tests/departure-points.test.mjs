import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/ui/departurePoints.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { unallocatedPoints } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const state = (balances, attributes = { body: 2, intellect: 1, spirit: 1 }, skills = { physical_activity: 2 }) =>
  ({ attributes, skills, ...balances }); // CP·SP 각각 다음 성장 비용 2

test('잔고가 남아도 다음 비용보다 부족하면 CP·SP 배분을 안내하지 않는다', () => {
  assert.equal(unallocatedPoints(state({ cp: 1, sp: 1 })), '');
  assert.equal(unallocatedPoints(state({ cp: 0, sp: 0 })), '');
  assert.equal(unallocatedPoints(state({ cp: 1 })), '');
});
test('비용과 같은 잔고부터 안내하며 배분 가능한 자원만 표시한다', () => {
  assert.equal(unallocatedPoints(state({ cp: 2, sp: 1 })), '2 CP');
  assert.equal(unallocatedPoints(state({ cp: 1, sp: 2 })), '2 SP');
  assert.equal(unallocatedPoints(state({ cp: 2, sp: 5 })), '2 CP · 5 SP');
  assert.equal(unallocatedPoints(state({ cp: 1 }, { body: 1 })), '1 CP');
});
test('성장 후 오른 비용과 보유 대상 유무를 반영한다', () => {
  assert.equal(unallocatedPoints(state({ cp: 3, sp: 3 }, { body: 3 }, { literacy: 3 })), '');
  assert.equal(unallocatedPoints(state({ cp: 0, sp: 10 }, { body: 1 }, {})), '');
  assert.equal(unallocatedPoints(state({ cp: 10, sp: 0 }, {}, { literacy: 1 })), '');
  assert.equal(unallocatedPoints(state({ cp: 10, sp: 10 }, { body: 1025 })), '10 SP');
});
test('이전 API에 SP 잔고를 만들지 않고 잘못된 잔고를 거절한다', () => {
  assert.equal(unallocatedPoints(state({ cp: 2 })), '2 CP');
  assert.throws(() => unallocatedPoints(state({ cp: -1 })));
  assert.throws(() => unallocatedPoints(state({ cp: 0, sp: NaN })));
});

test('신규 캐릭터의 레벨 0 지급 기준을 입장 안내에 전달한다', () => {
  const me = {cp:10,sp:5,attributes:{body:1,intellect:1,spirit:1},skills:{physical_activity:0,literacy:0,speaking:0},skillGrowthBaselines:{physical_activity:0,literacy:0,speaking:0}};
  assert.equal(unallocatedPoints(me),'10 CP · 5 SP');
  assert.equal(unallocatedPoints({...me,skills:{...me.skills,physical_activity:1}}),'10 CP · 5 SP');
});

test('CP만 많이 사용했어도 남은 SP의 첫 성장을 안내한다', () => {
  assert.equal(unallocatedPoints({cp:0,sp:5,attributes:{body:10},skills:{literacy:0},skillGrowthBaselines:{literacy:0}}),'5 SP');
  assert.equal(unallocatedPoints({cp:10,sp:0,attributes:{body:1},skills:{literacy:10},skillGrowthBaselines:{literacy:0}}),'10 CP');
});

test('비싼 스킬이 있어도 저렴한 다른 스킬에 배분 가능한 SP는 안내한다', () => {
  const me={cp:0,sp:1,attributes:{body:1},skills:{literacy:10,speaking:1},skillGrowthBaselines:{literacy:1,speaking:1}};
  assert.equal(unallocatedPoints(me),'1 SP');
  assert.equal(unallocatedPoints({...me,skills:{literacy:10,speaking:2}}),'');
});
