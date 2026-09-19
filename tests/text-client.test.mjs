import test from 'node:test';
import assert from 'node:assert/strict';
import { TextClient, ApiFailure, formatState } from '../scripts/text-client-core.mjs';

function state(extra = {}) {
  return { protocolVersion: 1, generation: 1, epoch: 1, cursor: 1,
    me: { name: '테스트', mode: 'FIELD', version: 4, cp: 10, sp: 5, position: { column: 0, row: 0 } },
    map: { name: '필드' }, monsters: [], ...extra };
}
function setup(responses) {
  const calls = [];
  const client = new TextClient('http://localhost:18080', { sleep: async () => {}, fetcher: async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers });
    assert.ok(responses.length, '예상하지 않은 요청');
    const result = responses.shift();
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify(result.body ?? result), { status: result.status ?? 200 });
  } });
  return { client, calls };
}
test('로그인 세션 전환 후 같은 v1 API로 조회·이동·전투 턴 명령을 보낸다', async () => {
  const battle = { id: 'battle-1', version: 7, turnId: 3, status: 'ACTIVE', order: ['test'], index: 0, units: [], tactics: {} };
  const { client, calls } = setup([
    { pending: true, operationId: 'op', receipt: 'receipt' },
    { access_token: 'test-access', refresh_token: 'test-refresh' }, state(),
    { state: state({ cursor: 2 }) }, { state: state({ cursor: 3, battle }) },
    { state: state({ cursor: 4, battle: { ...battle, version: 8 } }) },
  ]);
  await client.login('test', 'test-only');
  await client.execute('move 1 2');
  await client.execute('encounter monster-1');
  await client.execute('attack enemy-1');
  assert.equal(calls[1].url, 'http://localhost:18080/v1/auth/operations/op/resolve');
  assert.equal(calls[2].headers.Authorization, 'Bearer test-access');
  assert.equal(calls[3].body.expectedVersion, 4);
  assert.deepEqual(calls[3].body.position, { column: 1, row: 2 });
  assert.equal(calls[5].body.expectedVersion, 7);
  assert.deepEqual(calls[5].body.action, { type: 'ATTACK', battleId: 'battle-1', turnId: 3, targetId: 'enemy-1' });
  assert.equal(client.state.battle.version, 8);
});
test('전송 결과 불명은 같은 ID로 재시도하고 버전 충돌은 상태만 새로 읽는다', async () => {
  const { client, calls } = setup([new TypeError('network'), { state: state({ cursor: 2 }) },
    { status: 409, body: { code: 'VERSION_CONFLICT', messages: { ko: '버전 충돌', en: 'Conflict' } } }, state({ cursor: 3 })]);
  client.accept(state());
  await client.execute('enter');
  assert.deepEqual(calls[0].body, calls[1].body);
  await assert.rejects(client.execute('away'), error => error instanceof ApiFailure && error.code === 'VERSION_CONFLICT');
  assert.equal(calls.length, 4);
  assert.ok(calls[3].url.endsWith('/game/state'));
  assert.equal(client.state.cursor, 3);
});
test('조우 예약 준비와 전투 공간 준비는 별도 명령이다', async () => {
  const battle = { id: 'b', turnId: 0, version: 2 };
  const { client, calls } = setup([{ state: state({ cursor: 2, battle }) }, { state: state({ cursor: 3, battle }) }]);
  client.accept(state({ reservation: { id: 'reservation-1' } }));
  await client.execute('ready');
  await client.execute('ready');
  assert.ok(calls[0].url.endsWith('/encounters/ready'));
  assert.equal(calls[0].body.reservationId, 'reservation-1');
  assert.equal(calls[1].body.action.type, 'READY');
  assert.equal(calls[1].body.action.battleId, 'b');
});
test('잘못된 좌표·인수·미지원 명령은 전송하지 않으며 오래된 상태는 무시한다', async () => {
  const { client, calls } = setup([]);
  client.accept(state({ cursor: 5 }));
  for (const line of ['move -1 0', 'move 0.5 1', 'move 9007199254740992 1', 'end extra', 'attack', 'guard', 'cancel'])
    await assert.rejects(client.execute(line));
  client.accept(state({ cursor: 1 }));
  assert.equal(client.state.cursor, 5);
  assert.throws(() => client.accept(state({ protocolVersion: 9 })), ApiFailure);
  assert.equal(calls.length, 0);
});
test('적의 체력은 공개 단계만 표시하고 토큰·원시 상태를 출력하지 않는다', () => {
  const text = formatState(state({ battle: { id: 'b', status: 'ACTIVE', turnId: 1, order: ['u'], index: 0,
    units: [{ id: 'u', name: '몹', side: 'enemy', position: { column: 1, row: 2 }, hp: 99, maxHp: 123, healthVisibility: 'HIDDEN' }] } }));
  assert.match(text, /체력 정보 없음/);
  assert.doesNotMatch(text, /99|123/);
});

test('여러 방향의 웨이포인트에서 현재 좌표의 ID로 이동한다', async () => {
  for (const id of ['gate', 'gate-east', 'gate-south', 'gate-north']) {
    const initial=state({map:{connections:[{id,column:7,row:8,targetName:'목적지'}, {id:'elsewhere',column:1,row:1}]}});
    initial.me.position={column:7,row:8};
    const {client,calls}=setup([{state:state({cursor:2})}]);client.accept(initial);
    assert.match(formatState(initial),new RegExp(`웨이포인트 ${id}`));
    await client.execute(`gate${id === 'gate' ? '' : ' '+id}`);
    assert.equal(calls[0].body.connectionId,id);
  }
});
test('원격·미등록·전투 중 웨이포인트는 요청하지 않는다',async()=>{
 const {client,calls}=setup([]);client.accept(state({map:{connections:[{id:'gate-east',column:1,row:1}]}}));
 for(const input of ['gate','gate missing','gate gate-east','gate a b'])await assert.rejects(client.execute(input));
 client.state.battle={id:'b'};await assert.rejects(client.execute('gate'));
 assert.equal(calls.length,0);
});
test('아군 AP와 서버 행동 비용을 표시하고 적 숨김 체력은 유지한다',()=>{
 const text=formatState(state({battle:{id:'b',status:'ACTIVE',turnId:1,order:['a'],index:0,
 units:[{id:'a',name:'아군',side:'ally',position:{column:0,row:0},hp:10,maxHp:10,ap:2,maxAp:3}],
 tactics:{moves:[{position:{column:1,row:0},apCost:1,apAfter:1}],attacks:[{targetId:'e',apCost:3}]}}}));
 assert.match(text,/AP 2\/3/);assert.match(text,/1 AP → 잔여 1/);assert.match(text,/e \(3 AP\)/);
});
