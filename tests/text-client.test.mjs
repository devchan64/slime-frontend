import test from 'node:test';
import assert from 'node:assert/strict';
import { TextClient, ApiFailure, formatState, formatScoutingResult, formatCharacterBag, formatCharacterSkills, formatHuntLedger, formatAchievementRecords } from '../scripts/text-client-core.mjs';

function state(extra = {}) {
  return { protocolVersion: 1, generation: 1, epoch: 1, cursor: 1,
    me: { name: '테스트', mode: 'FIELD', version: 4, cp: 10, sp: 5, position: { column: 0, row: 0 } },
    map: { name: '필드' }, monsters: [], ...extra };
}
function setup(responses) {
  const calls = [];
  const client = new TextClient('http://localhost:18080', { sleep: async () => {}, fetcher: async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers, method:options.method });
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
  assert.match(renderedJournalOutput,/완료 보상: 4P/);
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
  assert.match(formatMainEventJournal(completedJournalFixture),/지급 보상: 4P/);
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

test('전투 스킬은 서버 명령 계약을 사용하며 전송 불명 재시도 본문을 유지한다', async () => {
  const currentBattleState = { id: 'battle-skill', version: 7, turnId: 3 };
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    new TypeError('network'), { state: state({ cursor: 2, battle: { ...currentBattleState, version: 8 } }) },
  ]);
  currentTextClient.accept(state({ battle: currentBattleState }));
  await currentTextClient.execute('use-skill one_hand_finishing_strike enemy-1');
  assert.equal(recordedClientCalls.length, 2);
  assert.equal(recordedClientCalls[0].url, 'http://localhost:18080/v1/game/battle/commands');
  assert.deepEqual(recordedClientCalls[0].body, recordedClientCalls[1].body);
  assert.equal(recordedClientCalls[0].body.expectedVersion, 7);
  assert.ok(recordedClientCalls[0].body.requestId);
  assert.deepEqual(recordedClientCalls[0].body.action, {
    type: 'SKILL', battleId: 'battle-skill', turnId: 3,
    actionId: 'one_hand_finishing_strike', targetId: 'enemy-1',
  });
  assert.equal(currentTextClient.state.battle.version, 8);
});

test('전투 스킬의 인수와 전투 상태 오류는 명령 전송 전에 거절한다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([]);
  currentTextClient.accept(state());
  for (const invalidSkillCommand of ['use-skill', 'use-skill action', 'use-skill action enemy extra', 'use-skill action enemy']) {
    await assert.rejects(currentTextClient.execute(invalidSkillCommand));
  }
  assert.equal(recordedClientCalls.length, 0);
});

function createSkillPreviewState(receivedSkillActions) {
  return state({ battle: { id: 'b', status: 'ACTIVE', turnId: 1, order: ['u'], index: 0,
    units: [{ id: 'enemy-1', name: '몹', side: 'enemy', position: { column: 1, row: 2 }, hp: 9876, maxHp: 9999, healthVisibility: 'HIDDEN' }],
    tactics: { skillActions: receivedSkillActions } } });
}

test('스킬 미리보기는 서버 비용과 복수 대상만 표시하고 적 체력을 공개하지 않는다', () => {
  const renderedStateText = formatState(createSkillPreviewState([
    { actionId: 'custom_action', name: '시험 스킬', apCost: 7, targets: [{ targetId: 'enemy-1', damage: 31 }, { targetId: 'enemy-2', damage: 12 }] },
    { actionId: 'unavailable_action', name: '대기 스킬', apCost: 15, targets: [] },
  ]));
  assert.match(renderedStateText, /시험 스킬 \[custom_action\] \| 7 AP/);
  assert.match(renderedStateText, /enemy-1 \(예상 피해 31\), enemy-2 \(예상 피해 12\)/);
  assert.match(renderedStateText, /use-skill custom_action 대상ID/);
  assert.match(renderedStateText, /대기 스킬.*대상: 없음 \(현재 사용 불가\)/);
  assert.doesNotMatch(renderedStateText, /9876|9999|use-skill unavailable_action/);
  assert.doesNotMatch(formatState(createSkillPreviewState(undefined)), /전투 스킬/);
});

test('잘못된 스킬 미리보기는 명확하게 거절한다', () => {
  const validSkillPreview = { actionId: 'action', name: '스킬', apCost: 3, targets: [{ targetId: 'enemy', damage: 2 }] };
  for (const invalidSkillPreview of [null, {}, [{ ...validSkillPreview, apCost: -1 }],
    [{ ...validSkillPreview, targets: [{ targetId: 'enemy', damage: '2' }] }],
    [validSkillPreview, validSkillPreview], [{ ...validSkillPreview, targets: [validSkillPreview.targets[0], validSkillPreview.targets[0]] }]]) {
    assert.throws(() => formatState(createSkillPreviewState(invalidSkillPreview)), /전투 스킬 응답 형식/);
  }
});

test('전투 스킬 버전 충돌은 조회 후 중단하며 새 턴에 자동 실행하지 않는다', async () => {
  const currentBattleState = { id: 'b', version: 7, turnId: 3 };
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    { status: 409, body: { code: 'VERSION_CONFLICT', messages: { ko: '버전 충돌', en: 'Conflict' } } },
    state({ cursor: 2, battle: { ...currentBattleState, version: 8, turnId: 4 } }),
  ]);
  currentTextClient.accept(state({ battle: currentBattleState }));
  await assert.rejects(currentTextClient.execute('use-skill action enemy'), receivedClientError => receivedClientError.code === 'VERSION_CONFLICT');
  assert.equal(recordedClientCalls.length, 2);
  assert.ok(recordedClientCalls[1].url.endsWith('/game/state'));
  assert.equal(currentTextClient.state.battle.turnId, 4);
});


function createScoutingResponse(currentResultOverrides = {}) {
  return { monsterId: 'monster-1', mapId: 'meadow', succeeded: true, observedAt: 100, expiresAt: 160,
    fpCost: 2, countBand: { minimumCount: 2, maximumCount: 4 }, riskGrade: 'HIGH', riskVersion: 1, ...currentResultOverrides };
}

test('정찰은 활동 갱신 후 명령을 보내고 공개 결과와 최신 FP를 표시한다', async () => {
  const updatedCharacterState = state({ cursor: 2 });
  updatedCharacterState.me.fp = 8;
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    {}, { state: updatedCharacterState, scouting: createScoutingResponse() },
  ]);
  currentTextClient.accept(state());
  const renderedCommandResult = await currentTextClient.interact('scout monster-1');
  assert.ok(recordedClientCalls[0].url.endsWith('/sessions/activity'));
  assert.ok(recordedClientCalls[1].url.endsWith('/game/skills/scout'));
  assert.deepEqual(Object.keys(recordedClientCalls[1].body).sort(), ['expectedVersion', 'monsterId', 'requestId']);
  assert.equal(recordedClientCalls[1].body.monsterId, 'monster-1');
  assert.equal(recordedClientCalls[1].body.expectedVersion, 4);
  assert.match(renderedCommandResult, /관측 인원 2~4마리.*위험도 높음/);
  assert.match(renderedCommandResult, /관측 시각 100.*만료 시각 160/);
  assert.match(renderedCommandResult, /FP 8/);
  assert.doesNotMatch(formatState(currentTextClient.state), /관측 인원/);
});

test('정찰 실패는 자동 반복하지 않으며 전송 불명에만 동일 요청을 재전송한다', async () => {
  const failedScoutingResult = { monsterId: 'monster-1', mapId: 'meadow', succeeded: false, observedAt: 100, expiresAt: 160, fpCost: 2 };
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    new TypeError('network'), { state: state({ cursor: 2 }), scouting: failedScoutingResult },
  ]);
  currentTextClient.accept(state());
  assert.match(await currentTextClient.execute('scout monster-1'), /정찰 monster-1.*실패.*소비 FP 2/);
  assert.equal(recordedClientCalls.length, 2);
  assert.deepEqual(recordedClientCalls[0].body, recordedClientCalls[1].body);
  assert.doesNotMatch(formatScoutingResult(failedScoutingResult), /인원|위험도/);
});

test('정찰은 비필드 상태와 잘못된 인수를 전송 전에 거절한다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([]);
  currentTextClient.accept(state({ battle: { id: 'b' } }));
  for (const invalidScoutingCommand of ['scout monster-1', 'scout', 'scout one two']) {
    await assert.rejects(currentTextClient.execute(invalidScoutingCommand));
  }
  assert.equal(recordedClientCalls.length, 0);
});

test('정찰은 공개 인원 구간과 선택적 위험도만 해석하며 잘못된 관측은 거절한다', () => {
  assert.match(formatScoutingResult(createScoutingResponse({ countBand: { minimumCount: 5, maximumCount: null } })), /5마리 이상/);
  assert.match(formatScoutingResult(createScoutingResponse({ countBand: { minimumCount: 1, maximumCount: 1 } })), /1마리/);
  const legacyScoutingResult = createScoutingResponse();
  delete legacyScoutingResult.riskGrade;
  delete legacyScoutingResult.riskVersion;
  assert.doesNotMatch(formatScoutingResult(legacyScoutingResult), /위험도/);
  for (const invalidScoutingResult of [null, createScoutingResponse({ expiresAt: 99 }),
    createScoutingResponse({ riskGrade: 'INVALID' }), createScoutingResponse({ riskVersion: 2 }),
    createScoutingResponse({ countBand: { minimumCount: 4, maximumCount: 2 } }),
    createScoutingResponse({ succeeded: false }), createScoutingResponse({ enemyHp: 100 })]) {
    assert.throws(() => formatScoutingResult(invalidScoutingResult), /정찰 응답 형식/);
  }
});


test('필드 회복은 회복량과 소비량 없이 서버 명령 계약으로 실행한다', async () => {
  const recoveredPlayerState = state({ cursor: 2 });
  recoveredPlayerState.me.hp = 5;
  recoveredPlayerState.me.maxHp = 20;
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    { state: recoveredPlayerState }, new TypeError('network'), { state: state({ cursor: 3 }) },
  ]);
  currentTextClient.accept(state());
  assert.match(formatState(await currentTextClient.execute('first-aid')), /HP 5\/20/);
  await currentTextClient.execute('use-item travel-biscuit');
  assert.ok(recordedClientCalls[0].url.endsWith('/skills/first-aid'));
  assert.deepEqual(Object.keys(recordedClientCalls[0].body).sort(), ['expectedVersion', 'requestId']);
  assert.ok(recordedClientCalls[1].url.endsWith('/consumables/use'));
  assert.deepEqual(Object.keys(recordedClientCalls[1].body).sort(), ['expectedVersion', 'itemId', 'requestId']);
  assert.equal(recordedClientCalls[1].body.itemId, 'travel-biscuit');
  assert.deepEqual(recordedClientCalls[1].body, recordedClientCalls[2].body);
});

test('가방은 최신 상태를 조회하고 직접 사용 가능한 품목에만 명령을 안내한다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([state({ cursor: 2, me: {
    ...state().me, bag: { items: [
      { id: 'clean-bandage', name: '깨끗한 붕대', kind: 'consumable', quantity: 2 },
      { id: 'food', name: '음식', kind: 'consumable', quantity: 3, useAction: { type: 'RESTORE_HP', restorationHp: 12, consumedOnSuccess: 1 } },
      { id: 'stone', name: '돌', kind: 'material', quantity: 5 },
    ] },
  } })]);
  currentTextClient.accept(state());
  const renderedBagResult = await currentTextClient.execute('bag');
  assert.ok(recordedClientCalls[0].url.endsWith('/game/state'));
  assert.match(renderedBagResult, /깨끗한 붕대 \[clean-bandage\] × 2/);
  assert.match(renderedBagResult, /HP 회복 12 · 소비 1개 \| 사용: use-item food/);
  assert.doesNotMatch(renderedBagResult, /use-item clean-bandage|use-item stone/);
  assert.equal(currentTextClient.state.cursor, 2);
});

test('회복 행동의 비필드 상태·잘못된 인수를 차단하며 서버 거절을 재시도하지 않는다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    { status: 409, body: { code: 'CONSUMABLE_REQUIRED', messages: { ko: '소모품 부족', en: 'Missing consumable' } } },
  ]);
  currentTextClient.accept(state({ battle: { id: 'b' } }));
  for (const invalidRecoveryCommand of ['first-aid', 'use-item food', 'first-aid extra', 'use-item', 'bag extra']) {
    await assert.rejects(currentTextClient.execute(invalidRecoveryCommand));
  }
  assert.equal(recordedClientCalls.length, 0);
  currentTextClient.accept(state({ cursor: 2 }));
  await assert.rejects(currentTextClient.execute('use-item food'), receivedClientError => receivedClientError.code === 'CONSUMABLE_REQUIRED');
  assert.equal(recordedClientCalls.length, 1);
});

test('가방은 잘못된 수량·중복 품목·잘못된 사용 행동을 거절한다', () => {
  const validBagItem = { id: 'food', name: '음식', kind: 'consumable', quantity: 1 };
  for (const invalidCharacterBag of [null, { items: {} }, { items: [{ ...validBagItem, quantity: 0 }] },
    { items: [validBagItem, validBagItem] }, { items: [{ ...validBagItem, useAction: { type: 'UNKNOWN' } }] },
    { items: [{ ...validBagItem, kind: 'material', useAction: { type: 'RESTORE_HP', restorationHp: 12, consumedOnSuccess: 1 } }] }]) {
    assert.throws(() => formatCharacterBag(invalidCharacterBag), /가방 응답 형식/);
  }
  assert.equal(formatCharacterBag({ items: [] }), '가방이 비어 있습니다.');
  assert.equal(formatCharacterBag(undefined), '현재 서버 응답에 가방 정보가 없습니다.');
});

test('가방은 회복과 경로·광원 표식의 공개 행동을 함께 표시한다', () => {
  const renderedBagResult = formatCharacterBag({ items: [
    { id: 'chalk', name: '분필', kind: 'consumable', quantity: 2, useAction: { type: 'PLACE_MARKER', markerKind: 'ROUTE', validSeconds: 120, consumedOnSuccess: 1 } },
    { id: 'lantern', name: '등불', kind: 'consumable', quantity: 1, useAction: { type: 'PLACE_MARKER', markerKind: 'LIGHT', validSeconds: 60, consumedOnSuccess: 1 } },
    { id: 'food', name: '음식', kind: 'consumable', quantity: 1, useAction: { type: 'RESTORE_HP', restorationHp: 5, consumedOnSuccess: 1 } },
  ] });
  assert.match(renderedBagResult, /경로 표식 120초 · 현재 타일 설치.*use-item chalk/);
  assert.match(renderedBagResult, /광원 표식 60초 · 현재 타일 설치.*use-item lantern/);
  assert.match(renderedBagResult, /HP 회복 5.*use-item food/);
  for (const invalidUseAction of [
    { type: 'PLACE_MARKER', markerKind: 'UNKNOWN', validSeconds: 60, consumedOnSuccess: 1 },
    { type: 'PLACE_MARKER', markerKind: 'LIGHT', validSeconds: 0, consumedOnSuccess: 1 },
    { type: 'PLACE_MARKER', markerKind: 'LIGHT', validSeconds: 60, consumedOnSuccess: 1, restorationHp: 5 },
  ]) assert.throws(() => formatCharacterBag({ items: [{ id: 'item', name: '품목', kind: 'consumable', quantity: 1, useAction: invalidUseAction }] }), /가방 응답 형식/);
});

function createMarkerStateFixture() {
  const currentGameState = state({ serverTime: 100, map: { id: 'meadow', name: '이슬초원' } });
  currentGameState.me.personalMarkers = [
    { id: 'own', mapId: 'meadow', kind: 'ROUTE', position: { column: 2, row: 3 }, createdAt: 90, expiresAt: 210 },
    { id: 'expired', mapId: 'meadow', kind: 'LIGHT', position: { column: 4, row: 5 }, createdAt: 40, expiresAt: 100 },
    { id: 'elsewhere', mapId: 'grove', kind: 'LIGHT', position: { column: 6, row: 7 }, createdAt: 90, expiresAt: 150 },
  ];
  return currentGameState;
}

test('개인 표식은 본인 현재 맵의 서버 시각 기준 유효 정보만 표시한다', () => {
  const currentGameState = createMarkerStateFixture();
  currentGameState.members = [{ personalMarkers: [{ position: { column: 98, row: 99 } }] }];
  const renderedStateResult = formatState(currentGameState);
  assert.match(renderedStateResult, /개인 경로 표식 \(2,3\).*만료 시각 210.*서버 시각 100 기준/);
  assert.doesNotMatch(renderedStateResult, /\(4,5\)|\(6,7\)|98|99/);
  currentGameState.serverTime = 210;
  assert.doesNotMatch(formatState(currentGameState), /개인 .*표식/);
  currentGameState.me.personalMarkers[0].position.column = -1;
  assert.throws(() => formatState(currentGameState), /개인 표식 응답 형식/);
});

test('표식 사용은 현재 타일 명령으로 실행하고 같은 재전송에 좌표를 추가하지 않는다', async () => {
  const currentGameState = createMarkerStateFixture();
  currentGameState.cursor = 2;
  currentGameState.me.hp = 20;
  currentGameState.me.maxHp = 20;
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    new TypeError('network'), { state: currentGameState },
  ]);
  const initialMarkerState = structuredClone(currentGameState);
  initialMarkerState.cursor = 1;
  initialMarkerState.me.personalMarkers = [];
  currentTextClient.accept(initialMarkerState);
  const renderedStateResult = formatState(await currentTextClient.execute('use-item chalk'));
  assert.match(renderedStateResult, /개인 경로 표식/);
  assert.deepEqual(recordedClientCalls[0].body, recordedClientCalls[1].body);
  assert.deepEqual(Object.keys(recordedClientCalls[0].body).sort(), ['expectedVersion', 'itemId', 'requestId']);
  assert.equal(recordedClientCalls[0].body.itemId, 'chalk');
});

test('스킬 목록은 최신 응답의 보유 스킬과 슬롯만 표시한다', async () => {
  const receivedSkillState = state();
  Object.assign(receivedSkillState.me, { skills: { physical_activity: 1, scouting: 0 },
    skillDefinitions: { physical_activity: { name: '신체활동' }, scouting: { name: '정찰' }, hidden: { name: '미보유' } },
    battleSkillLoadout: ['physical_activity'], battleSkillSlotLimit: 5 });
  const { client: currentTextClient, calls: recordedClientCalls } = setup([receivedSkillState]);
  currentTextClient.accept(state());
  const renderedSkillText = await currentTextClient.execute('skills');
  assert.match(renderedSkillText, /1\/5/);
  assert.match(renderedSkillText, /신체활동 \[physical_activity\] Lv.1 · 슬롯 지정/);
  assert.match(renderedSkillText, /정찰 \[scouting\] Lv.0/);
  assert.doesNotMatch(renderedSkillText, /미보유/);
  assert.ok(recordedClientCalls[0].url.endsWith('/game/state'));
});

test('슬롯 변경은 버전과 동일 재시도 ID를 유지하며 빈 목록으로 해제한다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    new Error('연결 종료'), { state: state() }, { state: state() },
  ]);
  currentTextClient.accept(state());
  await currentTextClient.execute('loadout physical_activity scouting');
  assert.ok(recordedClientCalls[0].url.endsWith('/characters/me/skill-loadout'));
  assert.deepEqual(recordedClientCalls[0].body.skills, ['physical_activity', 'scouting']);
  assert.equal(recordedClientCalls[0].body.expectedVersion, 4);
  assert.deepEqual(recordedClientCalls[0].body, recordedClientCalls[1].body);
  await currentTextClient.execute('loadout clear');
  assert.deepEqual(recordedClientCalls[2].body.skills, []);
});

test('슬롯 중복·잘못된 인수·전투 상태는 전송 전에 거절한다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([]);
  currentTextClient.accept(state());
  for (const invalidLoadoutCommand of ['loadout', 'loadout a a', 'loadout clear a', 'skills extra'])
    await assert.rejects(currentTextClient.execute(invalidLoadoutCommand));
  for (const blockedCharacterMode of ['IN_BATTLE', 'RESERVED']) {
    currentTextClient.state.me.mode = blockedCharacterMode;
    await assert.rejects(currentTextClient.execute('loadout clear'));
  }
  assert.equal(recordedClientCalls.length, 0);
});

test('슬롯의 서버 거절은 재시도하지 않고 기존 상태를 보존한다', async () => {
  const { client: currentTextClient, calls: recordedClientCalls } = setup([
    { status: 409, body: { code: 'INVALID_SKILL_LOADOUT', messages: { ko: '보유한 스킬만 지정할 수 있습니다.' } } },
  ]);
  currentTextClient.accept(state());
  await assert.rejects(currentTextClient.execute('loadout unknown_skill'), { code: 'INVALID_SKILL_LOADOUT' });
  assert.equal(currentTextClient.state.me.version, 4);
  assert.equal(recordedClientCalls.length, 1);
});

function createSkillActionCharacter() {
  return { skills: { one_handed_swordsmanship: 2, scouting: 0 }, battleSkillLoadout: ['one_handed_swordsmanship'],
    battleSkillSlotLimit: 5, skillDefinitions: {
      scouting: { name: '정찰', actions: [] },
      one_handed_swordsmanship: { name: '한손검술', actions: [
        { actionId: 'strike', name: '검격', requiredLevel: 1, apCost: 3, powerBasisPoints: 12000, requiredEquipment: 'one_handed_sword' },
        { actionId: 'finisher', name: '마무리', requiredLevel: 3, apCost: 5, powerBasisPoints: 16000, requiredEquipment: 'one_handed_sword' },
      ] },
    } };
}

test('스킬 액션의 레벨 조건과 전투 실행 조건을 구분한다', () => {
  const renderedSkillText = formatCharacterSkills(createSkillActionCharacter());
  assert.match(renderedSkillText, /검격 \[strike\] · 레벨 조건 충족 · 3 AP · 위력 배율 1.2 · 필요 장비: 한손검/);
  assert.match(renderedSkillText, /마무리 \[finisher\] · Lv.3 필요/);
  assert.match(renderedSkillText, /정찰 \[scouting\] Lv.0 · 효과 미활성/);
  assert.match(renderedSkillText, /AP·장비·턴·대상 조건/);
});

test('사용 잠금은 레벨·슬롯을 보존하여 표시하고 내부 출처는 출력하지 않는다', () => {
  const currentCharacterState = createSkillActionCharacter();
  currentCharacterState.skillUseLocks = { one_handed_swordsmanship: { reason: 'book_sold', bookId: 'private-book', sourceId: 'private-source' } };
  const renderedSkillText = formatCharacterSkills(currentCharacterState);
  assert.match(renderedSkillText, /Lv.2 · 슬롯 지정 · 사용 잠금/);
  assert.match(renderedSkillText, /검격 \[strike\] · 사용 잠금/);
  assert.doesNotMatch(renderedSkillText, /레벨 조건 충족|private-book|private-source/);
  assert.equal(currentCharacterState.skills.one_handed_swordsmanship, 2);
});

test('잘못된 스킬 액션·잠금 정보는 사용 가능으로 표시하지 않는다', () => {
  for (const invalidActionPatch of [{ apCost: -1 }, { requiredLevel: 0 }, { powerBasisPoints: 1.5 },
    { requiredEquipment: 'unknown' }, { actionId: '' }]) {
    const currentCharacterState = createSkillActionCharacter();
    Object.assign(currentCharacterState.skillDefinitions.one_handed_swordsmanship.actions[0], invalidActionPatch);
    assert.throws(() => formatCharacterSkills(currentCharacterState), /스킬 응답 형식/);
  }
  const currentCharacterState = createSkillActionCharacter();
  currentCharacterState.skillUseLocks = { scouting: { reason: 'unknown' } };
  assert.throws(() => formatCharacterSkills(currentCharacterState), /스킬 응답 형식/);
});

function createHuntLedgerPage() {
  return {entries:[{id:7,monsterInstanceId:'battle:enemy',monsterTypeId:'slime',battleId:'battle',spawnId:'meadow-passive',mapId:'meadow',quantity:1,result:'WIN',createdAt:100}],
    totals:[{monsterTypeId:'slime',quantity:12}],nextCursor:7};
}

test('사냥 원장은 인증된 페이지 조회만 보내고 현재 게임 상태를 보존한다',async()=>{
  const {client:currentTextClient,calls:recordedClientCalls}=setup([{},createHuntLedgerPage(),{entries:[],totals:[{monsterTypeId:'slime',quantity:12}],nextCursor:null}]);
  currentTextClient.setTokens({access_token:'token',refresh_token:'refresh'});
  const originalGameState=state();currentTextClient.accept(originalGameState);
  assert.match(await currentTextClient.interact('hunts'),/다음 페이지: hunts 7/);
  assert.match(await currentTextClient.execute('hunts 7'),/이 페이지에 기록이 없습니다/);
  assert.ok(recordedClientCalls[0].url.endsWith('/sessions/activity'));
  assert.ok(recordedClientCalls[1].url.endsWith('/characters/me/hunts?after=0&limit=50'));
  assert.ok(recordedClientCalls[2].url.endsWith('/characters/me/hunts?after=7&limit=50'));
  assert.equal(recordedClientCalls[1].headers.Authorization,'Bearer token');
  assert.equal(recordedClientCalls[1].body,undefined);
  assert.equal(currentTextClient.state,originalGameState);
});

test('사냥 조회의 잘못된 커서는 전송하지 않는다',async()=>{
  const {client:currentTextClient,calls:recordedClientCalls}=setup([]);
  for(const invalidHuntCommand of ['hunts -1','hunts 1.5','hunts abc','hunts 9007199254740992','hunts 1 2'])
    await assert.rejects(currentTextClient.execute(invalidHuntCommand));
  assert.equal(recordedClientCalls.length,0);
});

test('사냥 원장은 누적 수량과 현재 페이지를 구분하고 중복·후퇴 커서를 거절한다',()=>{
  assert.match(formatHuntLedger(createHuntLedgerPage()),/slime: 12/);
  assert.match(formatHuntLedger(createHuntLedgerPage()),/#7 slime × 1.*맵 meadow.*결과 WIN/);
  assert.throws(()=>formatHuntLedger(createHuntLedgerPage(),7),/사냥 원장/);
  for(const invalidLedgerPatch of [{nextCursor:8},{nextCursor:undefined},{totals:[]},{entries:[...createHuntLedgerPage().entries,...createHuntLedgerPage().entries]}])
    assert.throws(()=>formatHuntLedger({...createHuntLedgerPage(),...invalidLedgerPatch}),/사냥 원장/);
  assert.match(formatHuntLedger({entries:[],totals:[],nextCursor:null}),/기록 없음/);
});

test('보관함 조회는 상태를 유지하고 전체 수령은 합계 출력 후 상태를 갱신한다', async () => {
  const currentRewardCursor = '12345678-1234-1234-1234-123456789abc';
  const currentRewardPage = {serverTime:100,nextCursor:currentRewardCursor,entries:[{id:currentRewardCursor,storedAt:50,expiresAt:1000,
    materials:[{materialId:'protein-jelly',quantity:3,nameTranslations:{ko:'젤리',en:'Jelly'}}]}]};
  const {client:currentTextClient,calls:observedRequestCalls}=setup([currentRewardPage,{claimedCount:101,materials:[{materialId:'protein-jelly',quantity:303}]},state({cursor:2})]);
  currentTextClient.accept(state());
  assert.match(await currentTextClient.execute('rewards ' + currentRewardCursor), /젤리 × 3/);
  assert.equal(currentTextClient.state.cursor,1);
  assert.ok(observedRequestCalls[0].url.endsWith('?after=' + currentRewardCursor));
  assert.match(await currentTextClient.execute('rewards claim-all'), /101건\nprotein-jelly × 303/);
  assert.ok(observedRequestCalls[1].url.endsWith('/rewards/claim-all'));
  assert.deepEqual(observedRequestCalls[1].body,{});
  assert.equal(currentTextClient.state.cursor,2);
});

test('보관함 잘못된 인수는 송신하지 않고 수령 네트워크 오류는 자동 재시도하지 않는다',async()=>{
  const {client:currentTextClient,calls:observedRequestCalls}=setup([new Error('network lost')]);
  for(const invalidRewardCommand of ['rewards invalid','rewards claim-all extra'])await assert.rejects(currentTextClient.execute(invalidRewardCommand));
  assert.equal(observedRequestCalls.length,0);
  await assert.rejects(currentTextClient.execute('rewards claim-all'),/network lost/);
  assert.equal(observedRequestCalls.length,1);
});

test('전체 수령의 잘못된 건수·수량·중복 재료를 거절한다',async()=>{
  for(const malformedClaimResponse of [
    {claimedCount:-1,materials:[]},{claimedCount:1,materials:[]},
    {claimedCount:0,materials:[{materialId:'jelly',quantity:1}]},
    {claimedCount:1,materials:[{materialId:'jelly',quantity:0}]},
    {claimedCount:2,materials:[{materialId:'jelly',quantity:1},{materialId:'jelly',quantity:1}]}
  ]){
    const {client:currentTextClient,calls:observedRequestCalls}=setup([malformedClaimResponse]);
    await assert.rejects(currentTextClient.execute('rewards claim-all'));
    assert.equal(observedRequestCalls.length,1);
  }
});

test('텍스트 채널 조회는 현재 맵 목록과 좌석을 표시하고 게임 상태를 보존한다',async()=>{
 const currentChannelEntry={id:'instance-one',address:'aa22',mapDefinitionId:'meadow',status:'OPEN',onlineUsers:2,reservedSeats:3,capacity:30};
 const {client:currentTextClient,calls:currentRequestCalls}=setup([[currentChannelEntry,{...currentChannelEntry,id:'elsewhere',address:'b1',mapDefinitionId:'city'}]]);
 currentTextClient.accept(state({map:{id:'meadow'},channel:{id:'meadow',address:'a1',mapDefinitionId:'meadow'}}));
 const originalGameSnapshot=currentTextClient.state;
 const renderedChannelOutput=await currentTextClient.execute('channels');
 assert.match(renderedChannelOutput,/aa22 \[instance-one\].*예약 좌석 3\/30.*접속 2명/);
 assert.doesNotMatch(renderedChannelOutput,/elsewhere/);
 assert.equal(currentRequestCalls[0].body,undefined);assert.ok(currentRequestCalls[0].url.endsWith('/v1/channels'));
 assert.equal(currentTextClient.state,originalGameSnapshot);assert.match(formatState(currentTextClient.state),/채널 a1 \[meadow\]/);
});

test('텍스트 주소 이동은 정규화하고 전송 실패 시 동일 요청 ID로 재시도한다',async()=>{
 const {client:currentTextClient,calls:currentRequestCalls}=setup([new TypeError('network'),{state:state({epoch:2,channel:{id:'instance',address:'aa22',mapDefinitionId:'meadow'}})},{state:state({epoch:3})}]);
 currentTextClient.accept(state());
 await currentTextClient.execute('channel address AA0022');
 assert.ok(currentRequestCalls[0].url.endsWith('/v1/channels/joins'));assert.equal(currentRequestCalls[0].body.address,'aa22');
 assert.equal(currentRequestCalls[0].body.expectedVersion,4);assert.ok(currentRequestCalls[0].body.requestId);
 assert.deepEqual(currentRequestCalls[0].body,currentRequestCalls[1].body);assert.equal(currentTextClient.state.epoch,2);
 await currentTextClient.execute('channel id meadow');assert.equal(currentRequestCalls[2].body.channelId,'meadow');
});

test('텍스트 채널은 잘못된 입력·파티·전투·회복 대기를 전송 전에 거절한다',async()=>{
 const {client:currentTextClient,calls:currentRequestCalls}=setup([]);currentTextClient.accept(state());
 for(const currentCommandText of ['channel','channel aa22','channel address a0','channel address a-1','channel id bad/id','channel unknown a1','channels extra'])await assert.rejects(currentTextClient.execute(currentCommandText));
 currentTextClient.state.me.partyId='party';await assert.rejects(currentTextClient.execute('channel address a1'),/파티/);
 currentTextClient.state.me.partyId=null;currentTextClient.state.battle={id:'battle'};await assert.rejects(currentTextClient.execute('channel address a1'),/필드/);
 currentTextClient.state.battle=null;currentTextClient.state.me.battleId='returning-battle';
 await assert.rejects(currentTextClient.execute('channel id meadow'),/필드/);
 currentTextClient.state.me.battleId=null;currentTextClient.state.me.healthRecoveryPending=true;
 await assert.rejects(currentTextClient.execute('channel address a1'),/50%.*state/);
 currentTextClient.state.me.healthRecoveryPending=false;currentTextClient.state.me.hp=0;
 await assert.rejects(currentTextClient.execute('channel id meadow'),/50%.*state/);
 assert.equal(currentRequestCalls.length,0);
});

test('텍스트 채널 목록은 인원 미제공을 구분하고 중복·잘못된 응답을 거절한다',async()=>{
 const {formatChannelListingOutput}=await import('../scripts/text-channel-commands.mjs');
 const currentChannelEntry={id:'one',address:'a1',mapDefinitionId:'meadow',status:'OPEN'};
 assert.match(formatChannelListingOutput([currentChannelEntry],'meadow'),/인원 정보 미제공/);
 for(const currentInvalidResponse of [null,[currentChannelEntry,currentChannelEntry],[{...currentChannelEntry,address:'A1'}],[{...currentChannelEntry,id:'one\x1b'}],[{...currentChannelEntry,capacity:30}],[{...currentChannelEntry,onlineUsers:3,reservedSeats:2,capacity:30}],[{...currentChannelEntry,extra:true}]])assert.throws(()=>formatChannelListingOutput(currentInvalidResponse,'meadow'));
});

function createTravelerCommandFixture(){
 const currentGuardEntry={id:'gate-north-guard-center',cityId:'iseulon',mapId:'meadow',connectionId:'gate-north',name:'이슬온 경비센터',position:{column:0,row:0}};
 const currentGameSnapshot=state({map:{id:'meadow',guardCenters:[currentGuardEntry]},location:{id:'meadow'}});
 currentGameSnapshot.me.id='hero';
 const currentQuoteResponse={guardCenterId:currentGuardEntry.id,cityId:'iseulon',policyVersion:1,priceP:5,validitySeconds:604800,serverTime:100,expiresAt:160};
 return {currentGameSnapshot,currentGuardEntry,currentQuoteResponse};
}

test('텍스트 경비센터 조회·견적·발급은 확인한 5p와 요청 ID를 사용한다',async()=>{
 const {currentGameSnapshot,currentGuardEntry,currentQuoteResponse}=createTravelerCommandFixture();
 const {client:currentTextClient,calls:currentRequestCalls}=setup([currentQuoteResponse,new TypeError('network'),{state:{...currentGameSnapshot,cursor:2}}]);
 currentTextClient.accept(currentGameSnapshot);
 assert.match(await currentTextClient.execute('guards'),/이슬온 경비센터.*\(0,0\)/);assert.equal(currentRequestCalls.length,0);
 assert.match(await currentTextClient.execute('permit quote '+currentGuardEntry.id),/5P.*7일.*60초/);
 assert.equal(currentTextClient.state,currentGameSnapshot);assert.equal(currentRequestCalls[0].body,undefined);
 await currentTextClient.execute('permit buy '+currentGuardEntry.id);
 assert.ok(currentRequestCalls[1].url.endsWith('/traveler-permit-purchases'));
 assert.equal(currentRequestCalls[1].body.priceP,5);assert.equal(currentRequestCalls[1].body.policyVersion,1);assert.equal(currentRequestCalls[1].body.quotedExpiresAt,160);
 assert.equal(currentRequestCalls[1].body.expectedVersion,4);assert.ok(currentRequestCalls[1].body.requestId);
 assert.deepEqual(currentRequestCalls[1].body,currentRequestCalls[2].body);assert.equal(currentTextClient.travelerPermitQuote,null);
});

test('텍스트 증서 발급은 무견적·원격·전투·변경된 채널과 만료 견적을 거절한다',async()=>{
 const {currentGameSnapshot,currentGuardEntry,currentQuoteResponse}=createTravelerCommandFixture();
 const {client:currentTextClient,calls:currentRequestCalls}=setup([currentQuoteResponse,currentQuoteResponse]);
 currentTextClient.accept(currentGameSnapshot);
 await assert.rejects(currentTextClient.execute('permit buy '+currentGuardEntry.id),/견적/);
 await assert.rejects(currentTextClient.execute('permit quote other'),/경비센터/);
 currentTextClient.state.battle={id:'battle'};await assert.rejects(currentTextClient.execute('permit quote '+currentGuardEntry.id),/전투/);currentTextClient.state.battle=null;
 await currentTextClient.execute('permit quote '+currentGuardEntry.id);
 currentTextClient.state.epoch++;await assert.rejects(currentTextClient.execute('permit buy '+currentGuardEntry.id),/견적/);
 await currentTextClient.execute('permit quote '+currentGuardEntry.id);currentTextClient.travelerPermitQuote.receivedAt-=61000;
 await assert.rejects(currentTextClient.execute('permit buy '+currentGuardEntry.id),/견적/);
 assert.equal(currentRequestCalls.length,2);
});

test('텍스트 증서 견적의 요금·도시·기간·알 수 없는 필드를 검증한다',async()=>{
 const {validateTravelerQuoteResponse}=await import('../scripts/text-traveler-permits.mjs');
 const {currentGuardEntry,currentQuoteResponse}=createTravelerCommandFixture();
 for(const currentQuotePatch of [{priceP:6},{cityId:'reedhaven'},{validitySeconds:1},{expiresAt:100},{policyVersion:true},{extra:1}])assert.throws(()=>validateTravelerQuoteResponse({...currentQuoteResponse,...currentQuotePatch},currentGuardEntry));
});

function createTravelerSummaryFixture(){
 return {records:[{instanceId:'permit-one',itemId:'city-traveler-permit',characterId:'hero',cityId:'iseulon',cityName:'이슬온',issuerId:'gate-north-guard-center',issuedAt:100,expiresAt:604900,status:'VALID',quantity:1,weightG:null,nameTranslations:{ko:'여행자증명서',en:'Traveler Certificate'}}]};
}

test('텍스트 증서 조회는 개별 식별자·도시·발급처·UTC 기간과 만료 정각을 표시한다',async()=>{
 const {formatTravelerPermitSummary}=await import('../scripts/text-traveler-permits.mjs');
 const currentPermitSummary=createTravelerSummaryFixture();
 assert.match(formatTravelerPermitSummary(currentPermitSummary,100,'hero'),/이슬온 \[유효\].*permit-one.*gate-north.*1970-01-01T00:01:40.000Z/);
 currentPermitSummary.records[0].status='EXPIRED';
 assert.match(formatTravelerPermitSummary(currentPermitSummary,604900,'hero'),/만료/);
 assert.equal(currentPermitSummary.records.length,1);
 assert.match(formatTravelerPermitSummary({records:[]},100,'hero'),/보유한.*없습니다/);
 assert.match(formatTravelerPermitSummary(undefined,100,'hero'),/서버 응답에.*없습니다/);
});

test('텍스트 증서는 타인 소유·기간·상태·중복 오류를 거절하고 제어 문자를 제거한다',async()=>{
 const {formatTravelerPermitSummary}=await import('../scripts/text-traveler-permits.mjs');
 const currentPermitSummary=createTravelerSummaryFixture();
 for(const currentRecordPatch of [{characterId:'other'},{expiresAt:101},{status:'EXPIRED'},{quantity:2},{weightG:0},{extra:1}])assert.throws(()=>formatTravelerPermitSummary({records:[{...currentPermitSummary.records[0],...currentRecordPatch}]},100,'hero'));
 assert.throws(()=>formatTravelerPermitSummary({records:[...currentPermitSummary.records,...currentPermitSummary.records]},100,'hero'));
 currentPermitSummary.records[0].cityName='이슬온\u001b[2J';assert.doesNotMatch(formatTravelerPermitSummary(currentPermitSummary,100,'hero'),/\u001b/);
});

test('텍스트 가방과 상태에 본인 여행자증명서가 함께 표시된다',async()=>{
 const currentGameSnapshot=state({serverTime:100});currentGameSnapshot.me.id='hero';currentGameSnapshot.me.travelerPermitSummary=createTravelerSummaryFixture();
 const {client:currentTextClient}=setup([currentGameSnapshot]);currentTextClient.accept(currentGameSnapshot);
 assert.match(await currentTextClient.execute('bag'),/여행자증명서 · 이슬온 \[유효\]/);
 assert.match(formatState(currentTextClient.state),/여행자증명서 · 이슬온 \[유효\]/);
});

test('연속 응답 유실 뒤 조회·명시적 retry는 원래 요청을 보존하며 다른 변경을 차단한다',async()=>{
 const {client:currentTextClient,calls:currentRequestCalls}=setup([new TypeError('lost'),new TypeError('lost again'),state({cursor:2}),{state:state({cursor:3})},{state:state({cursor:4})}]);
 currentTextClient.accept(state());
 await assert.rejects(currentTextClient.execute('move 1 2'),/retry/);
 await assert.rejects(currentTextClient.execute('move 2 2'),/retry/);
 await assert.rejects(currentTextClient.execute('rewards claim-all'),/retry/);
 await currentTextClient.execute('state');
 await currentTextClient.execute('retry');
 assert.deepEqual(currentRequestCalls[0],currentRequestCalls[1]);
 assert.deepEqual(currentRequestCalls[0],currentRequestCalls[3]);
 await assert.rejects(currentTextClient.execute('retry'),/없습니다/);
 await currentTextClient.execute('move 2 2');
 assert.notEqual(currentRequestCalls[4].body.requestId,currentRequestCalls[0].body.requestId);
});
test('서버 5xx도 같은 요청으로 재시도하고 세션 교체 뒤 재전송하지 않는다',async()=>{
 const {client:currentTextClient,calls:currentRequestCalls}=setup([{status:503,body:{code:'UNAVAILABLE'}},{status:503,body:{code:'UNAVAILABLE'}}]);
 currentTextClient.accept(state());
 await assert.rejects(currentTextClient.execute('enter'),/retry/);
 assert.deepEqual(currentRequestCalls[0],currentRequestCalls[1]);
 currentTextClient.accept(state({generation:2}));
 await assert.rejects(currentTextClient.execute('retry'),/세션/);
 assert.equal(currentRequestCalls.length,2);
});
test('자동 재시도의 확정 거절은 대기 명령을 해제한다',async()=>{
 const {client:currentTextClient}=setup([new TypeError('lost'),{status:409,body:{code:'INVALID_STATE',message:'거절'}},{state:state({cursor:2})}]);
 currentTextClient.accept(state());
 await assert.rejects(currentTextClient.execute('enter'),/거절/);
 await currentTextClient.execute('away');
});


for(const currentMismatchKind of ['character','generation']){
 test(`명령 응답의 ${currentMismatchKind} 불일치는 상태를 보존하고 같은 요청으로 복구한다`,async()=>{
  const currentInitialState=state();
  currentInitialState.me.id='current-owner';
  const currentForeignState=structuredClone(currentInitialState);
  currentForeignState.cursor=2;
  if(currentMismatchKind==='character')currentForeignState.me.id='other-owner';
  else currentForeignState.generation=2;
  const currentValidState=structuredClone(currentInitialState);
  currentValidState.cursor=2;
  currentValidState.me.version=5;
  const {client:currentTextClient,calls:currentRequestCalls}=setup([
   {state:currentForeignState},{state:currentForeignState},{state:currentValidState},
  ]);
  currentTextClient.accept(currentInitialState);
  await assert.rejects(currentTextClient.execute('move 1 2'),/retry/);
  assert.deepEqual(currentTextClient.state,currentInitialState);
  assert.ok(currentTextClient.pendingCommandRequest);
  await currentTextClient.execute('retry');
  assert.deepEqual(currentTextClient.state,currentValidState);
  assert.equal(currentTextClient.pendingCommandRequest,null);
  assert.equal(currentRequestCalls.length,3);
  assert.deepEqual(currentRequestCalls[0].body,currentRequestCalls[1].body);
  assert.deepEqual(currentRequestCalls[0].body,currentRequestCalls[2].body);
 });
}


test('채널 조회 중 맵·캐릭터·세션 전환 시 이전 목록을 표시하지 않는다',async()=>{
 for(const currentContextChange of [
  currentTextClient=>{currentTextClient.state.map.id='city';},
  currentTextClient=>{currentTextClient.state.me.id='another';},
  currentTextClient=>{currentTextClient.state.generation+=1;},
  currentTextClient=>{currentTextClient.state.epoch+=1;},
  currentTextClient=>{currentTextClient.tokens={user_id:'hero',access_token:'new'};},
  currentTextClient=>{currentTextClient.state=null;},
 ]){
  let releaseChannelResponse;
  const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async()=>{
   await new Promise(currentResponseResolver=>{releaseChannelResponse=currentResponseResolver;});
   return new Response(JSON.stringify([{id:'one',address:'a1',mapDefinitionId:'meadow',status:'OPEN'}]));
  }});
  currentTextClient.accept(state({map:{id:'meadow'}}));currentTextClient.state.me.id='hero';
  currentTextClient.tokens={user_id:'hero',access_token:'old'};
  const currentPendingListing=currentTextClient.execute('channels');
  currentContextChange(currentTextClient);
  const currentPreservedState=currentTextClient.state;
  releaseChannelResponse();
  await assert.rejects(currentPendingListing,/조회 중/);
  assert.equal(currentTextClient.state,currentPreservedState);
 }
});

test('같은 맵에서 일반 상태 버전만 갱신되면 채널 목록을 표시한다',async()=>{
 let releaseChannelResponse;
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async()=>{
  await new Promise(currentResponseResolver=>{releaseChannelResponse=currentResponseResolver;});
  return new Response(JSON.stringify([{id:'one',address:'a1',mapDefinitionId:'meadow',status:'OPEN'}]));
 }});
 currentTextClient.accept(state({map:{id:'meadow'}}));
 const currentPendingListing=currentTextClient.execute('channels');
 currentTextClient.state.me.version+=1;currentTextClient.state.cursor+=1;
 releaseChannelResponse();
 assert.match(await currentPendingListing,/a1 \[one\]/);
 assert.equal(currentTextClient.state.me.version,5);
});


test('상태 조회는 본인의 길드 자격증과 단일 폰 잔액을 표시한다',()=>{
 const currentCharacterState=state();
 Object.assign(currentCharacterState.me,{id:'hero',coins:27,guildMembership:{guildId:'adventurers-guild',characterId:'hero',certificateStatus:'ISSUED'}});
 const currentRenderedState=formatState(currentCharacterState);
 assert.match(currentRenderedState,/모험자길드 소속 · 모험자길드 자격증 발급 완료/);
 assert.match(currentRenderedState,/폰\(PON\) 27P/);
 currentCharacterState.me.guildMembership.characterId='other';
 assert.throws(()=>formatState(currentCharacterState),/소유자/);
 delete currentCharacterState.me.guildMembership;
 assert.doesNotMatch(formatState(currentCharacterState),/미가입|미발급/);
});
test('응급처치 배치 선택을 원래 요청에 고정해 재시도한다',async()=>{
 const {client:currentTextClient,calls:currentRecordedCalls}=setup([new TypeError('network'),{state:state({cursor:2})}]);
 currentTextClient.accept(state());
 await currentTextClient.execute('first-aid bandage-1');
 assert.equal(currentRecordedCalls[0].body.batchId,'bandage-1');
 assert.deepEqual(currentRecordedCalls[0].body,currentRecordedCalls[1].body);
});
test('가방의 붕대 배치 식별자를 그대로 응급처치 명령에 사용할 수 있다',async()=>{
 const {client:currentTextClient,calls:currentRecordedCalls}=setup([{state:state({cursor:2})}]);
 currentTextClient.accept(state());
 await currentTextClient.execute('first-aid production-batch:bandage-1');
 assert.equal(currentRecordedCalls[0].body.batchId,'bandage-1');
 for(const currentInvalidIdentifier of ['production-batch:','production-batch:bad:extra'])await assert.rejects(currentTextClient.execute('first-aid '+currentInvalidIdentifier));
 assert.equal(currentRecordedCalls.length,1);
 const currentBagText=formatCharacterBag({items:[{id:'production-batch:bandage-1',batchId:'bandage-1',definitionId:'clean-bandage',kind:'consumable',itemLevel:2,performanceVersion:1,quantity:1,name:'붕대'}]});
 assert.match(currentBagText,/응급처치: first-aid production-batch:bandage-1/);
 assert.doesNotMatch(currentBagText,/use-item/);
});

test('개인 메시지의 응답 유실은 상대·본문·ID를 보존하고 PUT 차단과 확인을 별도 API로 전송한다',async()=>{
  const currentIssuedTimestamp=Date.now();
  const currentRequestIdentifier=currentIssuedTimestamp.toString(16).padStart(12,'0').replace(/^(.{8})(.{4})$/,'$1-$2')+'-7000-8000-000000000001';
  const currentTicketResponse={requestId:currentRequestIdentifier,characterId:'hero',firstSendBefore:currentIssuedTimestamp/1000+60,expiresAt:currentIssuedTimestamp/1000+30*86400};
  const {client:currentTextClient,calls:currentRequestCalls}=setup([currentTicketResponse,new TypeError('network'),{messageId:'100',sentAt:currentIssuedTimestamp/1000},{characterId:'friend',blocked:true},
    {serverTime:currentIssuedTimestamp/1000,peer:{characterId:'friend',name:'친구'},blocked:true,entries:[{messageId:'101',senderId:'friend',recipientId:'hero',text:'비공개\u001b[31m본문',sentAt:currentIssuedTimestamp/1000-10,expiresAt:currentIssuedTimestamp/1000+30}],nextCursor:null},{messageIds:['101']}]);
  currentTextClient.tokens={user_id:'hero',access_token:'test'};
  currentTextClient.accept(state({me:{id:'hero',name:'주인공',version:1}}));
  await assert.rejects(currentTextClient.execute('dm send friend 공백  유지'),/dm retry/);
  await assert.rejects(currentTextClient.execute('dm send outsider 다른 메시지'),/먼저 확인/);
  assert.equal(currentRequestCalls.length,2);
  assert.match(await currentTextClient.execute('dm retry'),/100/);
  assert.deepEqual(currentRequestCalls[1].body,currentRequestCalls[2].body);
  assert.equal(currentRequestCalls[1].body.text,'공백  유지');
  assert.equal(currentRequestCalls[1].body.expectedVersion,undefined);
  await currentTextClient.execute('dm block friend');
  assert.equal(currentRequestCalls[3].method,'PUT');
  const currentHistoryText=await currentTextClient.execute('dm read friend');
  assert.ok(!currentHistoryText.includes('\u001b'));
  assert.deepEqual(currentRequestCalls[5].body,{messageIds:['101']});
  assert.ok(currentTextClient.directMessageDisplayExpiresAt>performance.now());
  assert.equal(JSON.stringify(currentTextClient.state).includes('비공개'),false);
});

test('개인 메시지 만료·세션 변경은 본문을 폐기하고 위조 수신자 이력을 거절한다',async()=>{
  const {DirectMessageClient}=await import('../src/client/direct-messages.mjs');
  let currentSessionIdentity={characterId:'hero',generation:1};
  let currentClockElapsed=0;
  let currentDeferredResolve;
  const currentMessageClient=new DirectMessageClient(()=>new Promise(currentResolveCallback=>{currentDeferredResolve=currentResolveCallback;}),()=>currentSessionIdentity,()=>currentClockElapsed);
  const currentHistoryRequest=currentMessageClient.readDirectMessageHistory('friend');
  currentClockElapsed=2000;
  currentDeferredResolve({serverTime:100,peer:{characterId:'friend',name:'친구'},blocked:false,entries:[{messageId:'1',senderId:'friend',recipientId:'hero',text:'만료',sentAt:90,expiresAt:101}],nextCursor:null});
  assert.deepEqual((await currentHistoryRequest).entries,[]);
  const currentWrongRequest=currentMessageClient.readDirectMessageHistory('friend');
  currentDeferredResolve({serverTime:102,peer:{characterId:'friend',name:'친구'},blocked:false,entries:[{messageId:'2',senderId:'outsider',recipientId:'hero',text:'위조',sentAt:100,expiresAt:200}],nextCursor:null});
  await assert.rejects(currentWrongRequest,/invalidResponse/);
  const currentStaleRequest=currentMessageClient.listDirectMessageConversations();
  currentSessionIdentity={characterId:'other',generation:2};
  currentDeferredResolve({serverTime:102,entries:[],nextCursor:null});
  await assert.rejects(currentStaleRequest,/sessionChanged/);
  assert.throws(()=>currentMessageClient.readPendingDirectMessage(),/sessionChanged/);
});


test('텍스트 가방은 수집품과 정제 재료를 표시하고 정제 등급을 검증한다', () => {
  const currentCollectionItem = {id:'hide', name:'짐승 가죽', kind:'collection', quantity:2};
  const currentRefinedItem = {id:'tanned-hide-high', name:'상급 무두질 가죽', kind:'refined_material', grade:'high', quantity:3};
  assert.equal(formatCharacterBag({items:[currentCollectionItem,currentRefinedItem]}),
    '짐승 가죽 [hide] × 2\n상급 무두질 가죽 [tanned-hide-high] × 3');
  for (const currentInvalidItem of [
    {...currentRefinedItem,grade:undefined}, {...currentRefinedItem,grade:'invalid'},
    {...currentCollectionItem,grade:'high'},
    {...currentRefinedItem,useAction:{type:'RESTORE_HP',restorationHp:1,consumedOnSuccess:1}},
  ]) assert.throws(()=>formatCharacterBag({items:[currentInvalidItem]}), /가방 응답 형식/);
});

test('업적 명령은 현재·과거 정의와 지급 이력을 읽기 전용으로 구분한다', async () => {
  const currentDefinitionRecord={name:'현재 업적',checklist:{use:{description:'현재 사용',target:10}}};
  const currentPastDefinition={name:'과거 업적',checklist:{use:{description:'과거 사용',target:100}}};
  const currentProgressResponse={seasonId:'new',cp:10,sp:2,achievements:{current:{completedAt:null,checklist:{use:{count:3}}}},cpLedger:[],spLedger:[],
    history:{old:{catalog:{past:currentPastDefinition},achievements:{past:{completedAt:1,checklist:{use:{count:100}}}},seasonalAchievements:{},
      cpLedger:[{achievementId:'past',amount:1}],spLedger:[{achievementId:'past',amount:1}]}}};
  const currentOriginalResponse=JSON.stringify(currentProgressResponse);
  const {client:currentTextClient,calls:currentRecordedCalls}=setup([currentProgressResponse,{achievements:{current:currentDefinitionRecord}},currentProgressResponse,currentProgressResponse]);
  const currentRenderedText=await currentTextClient.execute('achievements');
  assert.match(currentRenderedText,/현재 업적.*진행 중/);
  assert.match(currentRenderedText,/3\/10/);
  const currentArchivedText=await currentTextClient.execute('achievements old');
  assert.match(currentArchivedText,/현재 잔고: 10 CP · 2 SP/);
  assert.match(currentArchivedText,/과거 업적.*완료/);
  assert.match(currentArchivedText,/100\/100/);
  assert.match(currentArchivedText,/과거 업적 \+1 CP/);
  assert.match(currentArchivedText,/과거 업적 \+1 SP/);
  assert.match(currentArchivedText,/보상은 다시 지급되지 않습니다/);
  assert.doesNotMatch(currentArchivedText,/현재 업적/);
  await assert.rejects(currentTextClient.execute('achievements missing'),/보존된 시즌/);
  await assert.rejects(currentTextClient.execute('achievements old extra'),/시즌ID/);
  assert.equal(JSON.stringify(currentProgressResponse),currentOriginalResponse);
  assert.ok(currentRecordedCalls.every(currentRequestRecord=>currentRequestRecord.method==='GET'&&currentRequestRecord.body===undefined));
  assert.equal(currentRecordedCalls.filter(currentRequestRecord=>currentRequestRecord.url.endsWith('/v1/achievements')).length,1);
});


test('업적 이력 필드 미지원과 손상된 null 응답을 구분한다', () => {
  const currentProgressResponse={seasonId:'initial',cp:10,sp:0,achievements:{},cpLedger:[],spLedger:[]};
  assert.match(formatAchievementRecords(currentProgressResponse,{achievements:{}}),/보존 시즌: 없음/);
  for(const currentInvalidHistory of [null,[],42])
    assert.throws(()=>formatAchievementRecords({...currentProgressResponse,history:currentInvalidHistory},{achievements:{}}),/업적 응답 형식/);
});

test('자동전투 전환·패턴 저장·삭제는 기존 버전과 명령 전송 경로를 사용한다', async () => {
  const currentBattleState = {id:'b',version:7,turnId:3,status:'ACTIVE',order:['me'],index:0,units:[],tactics:{}};
  const currentPatternRecord = {version:1,rules:[{condition:'ALWAYS',action:'END_TURN'}]};
  const {client:currentTextClient,calls:currentRequestCalls} = setup([
    {state:state({cursor:2,battle:currentBattleState})},
    {state:state({cursor:3,battle:currentBattleState})},
    {state:state({cursor:4,battle:currentBattleState})},
    {characterVersion:4,pattern:currentPatternRecord},
    {state:state({cursor:5,battle:currentBattleState})},
  ]);
  currentTextClient.accept(state({battle:currentBattleState}));
  await currentTextClient.execute('auto on');
  await currentTextClient.execute('auto off');
  await currentTextClient.execute('pattern set '+JSON.stringify(currentPatternRecord));
  assert.equal(JSON.parse(await currentTextClient.execute('pattern show')).rules[0].action,'END_TURN');
  await currentTextClient.execute('pattern clear');
  assert.deepEqual(currentRequestCalls[0].body.action,{type:'AUTO_PLAY',battleId:'b',turnId:3,enabled:true});
  assert.equal(currentRequestCalls[1].body.action.enabled,false);
  assert.equal(currentRequestCalls[0].body.expectedVersion,7);
  assert.equal(currentRequestCalls[2].body.expectedVersion,4);
  assert.deepEqual(currentRequestCalls[2].body.pattern,currentPatternRecord);
  assert.ok(currentRequestCalls[2].url.endsWith('/v1/characters/me/automatic-pattern'));
  assert.equal(currentRequestCalls[4].body.pattern,null);
  for (const currentInvalidCommand of ['auto yes','auto on extra','pattern clear extra','pattern set null','pattern set []','pattern set {','pattern what'])
    await assert.rejects(currentTextClient.execute(currentInvalidCommand));
  assert.equal(currentRequestCalls.length,5);
});

test('개발자 포인트 조정은 본인 요청과 재시도 ID를 유지하고 영수증 뒤 최신 상태를 읽는다',async()=>{
 const currentRequestRecords=[];
 let currentAttemptCount=0;
 const currentInitialState=state({me:{...state().me,id:'test',coins:0}});
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  const currentRequestBody=currentRequestOptions.body?JSON.parse(currentRequestOptions.body):undefined;
  currentRequestRecords.push({url:currentRequestUrl,body:currentRequestBody});
  if(currentRequestUrl.endsWith('/v1/developer/catalog'))return Response.json({accountId:'test',targetScope:'SELF',entries:[{category:'material',itemId:'protein-jelly',nameTranslations:{ko:'단백질 젤리',en:'Protein jelly'},supportedOperations:[]}]});
  if(currentRequestUrl.endsWith('/v1/developer/adjustments')){
   currentAttemptCount++;
   if(currentAttemptCount<=2)throw new Error('응답 유실');
   return Response.json({ok:true,requestId:currentRequestBody.requestId,actorId:'test',characterId:'test',asset:'CP',operation:'ADD',quantity:10,before:10,after:20,version:5});
  }
  assert.ok(currentRequestUrl.endsWith('/v1/game/state'));
  return Response.json({...currentInitialState,cursor:2,me:{...currentInitialState.me,version:5,cp:20}});
 }});
 currentTextClient.tokens={user_id:'test',access_token:'local-test'};
 currentTextClient.accept(currentInitialState);
 await assert.rejects(currentTextClient.execute('dev add cp 10'),/retry/);
 assert.equal(currentTextClient.state.me.cp,10);
 assert.match(await currentTextClient.execute('retry'),/CP 10 → 20/);
 assert.equal(currentTextClient.state.me.cp,20);
 assert.deepEqual(currentRequestRecords[0].body,currentRequestRecords[2].body);
 assert.equal(Object.hasOwn(currentRequestRecords[0].body,'targetId'),false);
 assert.equal(currentTextClient.pendingCommandRequest,null);
 for(const currentInvalidCommand of ['dev add cp 0','dev add p -1','dev remove sp 1.5','dev add cp 2 other','dev add p 1000000001'])
  await assert.rejects(currentTextClient.execute(currentInvalidCommand),/형식/);
 assert.equal(currentRequestRecords.length,4);
 assert.match(await currentTextClient.execute('dev items'),/material protein-jelly · 단백질 젤리 · 조정 미지원/);
 assert.equal(currentRequestRecords[4].body,undefined);
});


test('개발자 수량형 아이템 명령은 분류·품목과 요청을 전달한다',async()=>{
 const currentCommandRecords=[];
 const currentInitialState=state({me:{...state().me,id:'test'}});
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  if(currentRequestUrl.endsWith('/v1/developer/adjustments')){
   const currentRequestBody=JSON.parse(currentRequestOptions.body);currentCommandRecords.push(currentRequestBody);
   return Response.json({ok:true,...currentRequestBody,actorId:'test',characterId:'test',before:2,after:0,version:5});
  }
  return Response.json({...currentInitialState,cursor:2,me:{...currentInitialState.me,version:5}});
 }});
 currentTextClient.tokens={user_id:'test',access_token:'local-test'};currentTextClient.accept(currentInitialState);
 assert.match(await currentTextClient.execute('dev item remove material protein-jelly 2'),/material protein-jelly 2 → 0/);
 assert.equal(currentCommandRecords[0].asset,'ITEM');assert.equal(currentCommandRecords[0].itemId,'protein-jelly');
 assert.equal(currentCommandRecords[0].category,'material');assert.equal(currentCommandRecords[0].operation,'REMOVE');
 for(const currentInvalidCommand of ['dev item add costume unknown 1','dev item remove material protein-jelly 0','dev item add material protein-jelly 1 other'])
  await assert.rejects(currentTextClient.execute(currentInvalidCommand),/형식/);
 assert.equal(currentCommandRecords.length,1);
});

test('개발자 장비 회수는 본인 재고에서 개체 버전을 확인한다',async()=>{
 const currentInstanceIdentifier='00000000-0000-4000-8000-000000000011';
 const currentInitialState=state({me:{...state().me,id:'test'}});
 const currentCommandPayloads=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
  if(currentRequestUrl.endsWith('/v1/developer/inventory'))return Response.json({characterId:'test',version:currentInitialState.me.version,items:[{category:'equipment',itemId:'iron-sword',quantity:1,instanceId:currentInstanceIdentifier,instanceVersion:3,removable:true}]});
  if(currentRequestUrl.endsWith('/v1/developer/adjustments')){
   const currentRequestBody=JSON.parse(currentRequestOptions.body);currentCommandPayloads.push(currentRequestBody);
   return Response.json({ok:true,...currentRequestBody,actorId:'test',characterId:'test',before:1,after:0,version:currentInitialState.me.version+1,instanceVersion:4});
  }
  return Response.json({...currentInitialState,cursor:2,me:{...currentInitialState.me,version:currentInitialState.me.version+1}});
 }});
 currentTextClient.tokens={user_id:'test',access_token:'local-test'};currentTextClient.accept(currentInitialState);
 assert.match(await currentTextClient.execute('dev item remove equipment '+currentInstanceIdentifier),/iron-sword 1 → 0/);
 assert.equal(currentCommandPayloads[0].instanceId,currentInstanceIdentifier);
 assert.equal(currentCommandPayloads[0].expectedInstanceVersion,3);
 assert.equal(currentCommandPayloads[0].quantity,1);
});

test('개발자 증서 명령은 도시·발급처와 회수 개체를 전달한다',async()=>{
 for(const currentOperationName of ['add','remove']){
  const currentInstanceIdentifier='00000000-0000-4000-8000-000000000012';
  const currentInitialState=state({me:{...state().me,id:'test'}});
  let currentSentPayload;
  const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{
   if(currentRequestUrl.endsWith('/v1/developer/catalog'))return Response.json({accountId:'test',permitIssuers:[{cityId:'iseulon',issuerId:'gate-guard-center'}]});
   if(currentRequestUrl.endsWith('/v1/developer/adjustments')){
    currentSentPayload=JSON.parse(currentRequestOptions.body);
    return Response.json({ok:true,...currentSentPayload,actorId:'test',characterId:'test',before:currentOperationName==='add'?0:1,after:currentOperationName==='add'?1:0,version:currentInitialState.me.version+1,
     instanceId:currentInstanceIdentifier,permit:{characterId:'test',cityId:'iseulon',issuerId:'gate-guard-center'}});
   }
   return Response.json({...currentInitialState,cursor:2,me:{...currentInitialState.me,version:currentInitialState.me.version+1}});
  }});
  currentTextClient.tokens={user_id:'test',access_token:'local-test'};currentTextClient.accept(currentInitialState);
  assert.match(await currentTextClient.execute('dev permit issuers'),/iseulon · gate-guard-center/);
  await currentTextClient.execute(currentOperationName==='add'?'dev permit add iseulon gate-guard-center':'dev permit remove '+currentInstanceIdentifier);
  assert.equal(currentSentPayload.category,'traveler_permit');assert.equal(currentSentPayload.quantity,1);
  if(currentOperationName==='add'){assert.equal(currentSentPayload.cityId,'iseulon');assert.equal(currentSentPayload.issuerId,'gate-guard-center');}
  else assert.equal(currentSentPayload.instanceId,currentInstanceIdentifier);
 }
});
