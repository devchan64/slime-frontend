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

test('터미널 직접 상태 조회·도움말은 활동을 알리고 자동 처리는 알리지 않는다',async()=>{
 const {client,calls}=setup([{ok:true},state(),{ok:true},{ok:true},state()]);client.accept(state());
 await client.interact('state');
 assert.ok(calls[0].url.endsWith('/sessions/activity'));assert.deepEqual(calls[0].body,{});
 assert.ok(calls[1].url.endsWith('/game/state'));
 assert.equal(await client.interact('help'),null);assert.ok(calls[2].url.endsWith('/sessions/activity'));
 await client.heartbeat();await client.snapshot();
 assert.ok(calls[3].url.endsWith('/sessions/heartbeat'));assert.ok(calls[4].url.endsWith('/game/state'));
 assert.equal(await client.interact('  '),null);assert.equal(calls.length,5);
});
test('유휴 만료 활동 알림은 명령을 실행하거나 자동 재시도하지 않는다',async()=>{
 const {client,calls}=setup([{status:409,body:{code:'IDLE_DISCONNECTED',message:'다시 로그인'}}]);client.accept(state());
 await assert.rejects(client.interact('enter'),error=>error.code==='IDLE_DISCONNECTED');
 assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/sessions/activity'));
});

test('휴식은 HP 0에서도 명령 버전과 요청 ID를 사용하고 전투 중에는 보내지 않는다', async () => {
  const {client, calls} = setup([{state:state({cursor:2})},{state:state({cursor:3})}]);
  client.accept(state());
  client.state.me.hp=0;
  await client.execute('rest start');
  await client.execute('rest stop');
  assert.ok(calls[0].url.endsWith('/rest/start'));
  assert.ok(calls[1].url.endsWith('/rest/stop'));
  assert.equal(calls[0].body.expectedVersion,4);
  assert.ok(calls[0].body.requestId);
  await assert.rejects(client.execute('rest invalid'));
  client.state.battle={id:'battle'};
  await assert.rejects(client.execute('rest start'),/필드/);
  assert.equal(calls.length,2);
});

test('대여 목록은 조회만 하고 전투 상태를 덮어쓰지 않으며 페이지 커서를 인코딩한다', async () => {
  const {client, calls} = setup([{serverTime:100,nextCursor:'next',entries:[{id:'loan',name:'파티원',hp:0,maxHp:25,expiresAt:99,inBattle:true}]}]);
  client.accept(state());
  const originalClientState=client.state;
  const renderedLoanResult=await client.execute('loans a/b');
  assert.match(renderedLoanResult,/HP 0\/25/);
  assert.match(renderedLoanResult,/전투 참가 중.*대여 만료/);
  assert.match(renderedLoanResult,/loans next/);
  assert.ok(calls[0].url.endsWith('/v1/game/loans?after=a%2Fb'));
  assert.equal(calls[0].body,undefined);
  assert.equal(client.state,originalClientState);
});

test('회복 대기는 HP가 낮은 것과 구분하여 필드와 전투 상태에 표시한다',()=>{
 const recoveredStateRecord=state();
 recoveredStateRecord.me.hp=1;recoveredStateRecord.me.maxHp=10;
 assert.doesNotMatch(formatState(recoveredStateRecord),/회복 대기/);
 recoveredStateRecord.me.id='hero';recoveredStateRecord.me.healthRecoveryPending=true;
 assert.match(formatState(recoveredStateRecord),/50% 이상 회복 전 이동 불가/);
 recoveredStateRecord.battle={id:'battle',status:'ACTIVE',order:['hero'],index:0,units:[{id:'hero',name:'캐릭터',side:'ally',hp:1,maxHp:10,position:{column:0,row:0},healthRecoveryPending:true}],tactics:{moves:[],attacks:[]}};
 assert.match(formatState(recoveredStateRecord),/전투 이동 불가: 전투불능 회복 대기/);
});

function createJournalResponseFixture() {
  const currentNpcFixture = {id:'npc',name:'담당자',cityId:'city',facilityId:'guild'};
  return {serverTime:100,characterVersion:4,entries:[{
    eventId:'delivery',title:'첫 배달',status:'ACCEPTED',acceptedAt:10,completedAt:null,
    moneyP:4,materialsSufficient:true,giver:currentNpcFixture,receiver:currentNpcFixture,
    items:[{itemId:'jelly',required:2,owned:3,nameTranslations:{ko:'젤리',en:'Jelly'}}],
  }]};
}

test('의뢰 기록 명령은 인증 조회로 현재 재료와 목적지를 표시하고 게임 상태를 보존한다', async () => {
  const {client:currentTextClient,calls:currentRequestCalls}=setup([createJournalResponseFixture()]);
  currentTextClient.accept(state());
  currentTextClient.tokens={access_token:'journal-access'};
  const originalGameSnapshot=currentTextClient.state;
  const renderedJournalOutput=await currentTextClient.execute('journal');
  assert.match(renderedJournalOutput,/첫 배달 \[진행 중\]/);
  assert.match(renderedJournalOutput,/전달: 담당자 \(city \/ guild\)/);
  assert.match(renderedJournalOutput,/현재 3 \/ 필요 2/);
  assert.match(renderedJournalOutput,/완료 보상: 4p/);
  assert.match(renderedJournalOutput,/전달 권한은 별도/);
  assert.equal(currentRequestCalls[0].url,'http://localhost:18080/v1/game/main-events');
  assert.equal(currentRequestCalls[0].body,undefined);
  assert.equal(currentRequestCalls[0].headers.Authorization,'Bearer journal-access');
  assert.equal(currentTextClient.state,originalGameSnapshot);
  await assert.rejects(currentTextClient.execute('journal accept'),/인수/);
  assert.equal(currentRequestCalls.length,1);
});

test('의뢰 기록은 빈 목록과 완료를 구분하고 잘못된 수량·중복·완료 상태를 거절한다', async () => {
  const {formatMainEventJournal}=await import('../scripts/text-client-core.mjs');
  const currentJournalFixture=createJournalResponseFixture();
  assert.match(formatMainEventJournal({...currentJournalFixture,entries:[]}),/수령한 메인 의뢰가 없습니다/);
  const completedJournalFixture=structuredClone(currentJournalFixture);
  Object.assign(completedJournalFixture.entries[0],{status:'COMPLETED',completedAt:20,materialsSufficient:false});
  assert.match(formatMainEventJournal(completedJournalFixture),/지급 보상: 4p/);
  assert.doesNotMatch(formatMainEventJournal(completedJournalFixture),/재료 충족/);
  for (const corruptJournalFixture of [
    {...currentJournalFixture,entries:[...currentJournalFixture.entries,...currentJournalFixture.entries]},
    {...currentJournalFixture,entries:[{...currentJournalFixture.entries[0],materialsSufficient:false}]},
    {...currentJournalFixture,entries:[{...currentJournalFixture.entries[0],status:'COMPLETED'}]},
    {...currentJournalFixture,entries:[{...currentJournalFixture.entries[0],items:[{...currentJournalFixture.entries[0].items[0],owned:-1}]}]},
  ]) assert.throws(()=>formatMainEventJournal(corruptJournalFixture),/응답/);
  currentJournalFixture.entries[0].title='첫\u001b[2J 배달';
  assert.doesNotMatch(formatMainEventJournal(currentJournalFixture),/\u001b/);
});

test('의뢰 조회 실패는 재시도하거나 캐릭터 상태를 덮어쓰지 않는다', async () => {
  const {client:currentTextClient,calls:currentRequestCalls}=setup([{status:401,body:{code:'SESSION_EXPIRED',message:'만료'}}]);
  currentTextClient.accept(state());
  const originalGameSnapshot=currentTextClient.state;
  await assert.rejects(currentTextClient.execute('journal'),currentApiError=>currentApiError.code==='SESSION_EXPIRED');
  assert.equal(currentTextClient.state,originalGameSnapshot);
  assert.equal(currentRequestCalls.length,1);
});
