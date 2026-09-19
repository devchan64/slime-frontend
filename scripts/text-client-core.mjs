import { randomUUID } from 'node:crypto';

const BATTLE_PATH = '/v1/game/battle/commands';
export class ApiFailure extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// 브라우저·자산·비공개 서버 모듈에 의존하지 않는 HTTP 클라이언트다.
export class TextClient {
  constructor(baseUrl, { fetcher = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error('인증 정보·쿼리 없는 HTTP(S) API 주소가 필요합니다.');
    this.baseUrl = url.href.replace(/\/$/, '');
    this.fetcher = fetcher;
    this.sleep = sleep;
    this.tokens = null;
    this.state = null;
  }
  async request(path, body) {
    const response = await this.fetcher(this.baseUrl + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.tokens ? { Authorization: `Bearer ${this.tokens.access_token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    let result;
    try { result = await response.json(); }
    catch { throw new ApiFailure('INVALID_API_RESPONSE', '서버가 올바른 JSON을 반환하지 않았습니다.'); }
    if (!response.ok) throw new ApiFailure(result.code, result.messages?.ko ?? result.message ?? `HTTP ${response.status}`);
    return result;
  }
  async resolve(result) {
    for (let attempt = 0; result.pending && attempt < 60; attempt++) {
      if (typeof result.operationId !== 'string' || typeof result.receipt !== 'string')
        throw new ApiFailure('INVALID_API_RESPONSE', '세션 전환 정보가 누락되었습니다.');
      await this.sleep(1000);
      result = await this.request(`/v1/auth/operations/${encodeURIComponent(result.operationId)}/resolve`, { receipt: result.receipt });
    }
    if (result.pending) throw new ApiFailure('TRANSITION_TIMEOUT', '세션 전환이 지연되고 있습니다. 다시 로그인하세요.');
    return result;
  }
  accept(state) {
    if (state?.protocolVersion !== 1 || !state.me ||
        !['generation', 'epoch', 'cursor'].every(key => Number.isSafeInteger(state[key])) ||
        !Number.isSafeInteger(state.me.version))
      throw new ApiFailure('INVALID_API_RESPONSE', '지원하지 않거나 불완전한 상태 응답입니다.');
    const old = this.state;
    if (old && (state.generation < old.generation ||
        (state.generation === old.generation && (state.epoch < old.epoch ||
        (state.epoch === old.epoch && state.cursor < old.cursor))))) return;
    this.state = state;
  }
  setTokens(tokens) {
    if (typeof tokens?.access_token !== 'string' || typeof tokens.refresh_token !== 'string')
      throw new ApiFailure('INVALID_API_RESPONSE', '로그인 토큰이 누락되었습니다.');
    this.tokens = tokens;
  }
  async login(user_id, password) {
    this.setTokens(await this.resolve(await this.request('/v1/auth/login', { user_id, password })));
    await this.snapshot();
  }
  async snapshot() { this.accept(await this.request('/v1/game/state')); return this.state; }
  async refresh() { this.setTokens(await this.request('/v1/auth/refresh', { refresh_token: this.tokens.refresh_token })); }
  async heartbeat() { await this.request('/v1/sessions/heartbeat', {}); }
  async logout() {
    await this.resolve(await this.request('/v1/auth/logout', {}));
    this.tokens = null;
    this.state = null;
  }
  async command(path, body = {}) {
    if (!this.state) throw new Error('먼저 로그인하세요.');
    const expectedVersion = path === BATTLE_PATH ? this.state.battle?.version : this.state.me.version;
    if (!Number.isSafeInteger(expectedVersion)) throw new Error('명령에 필요한 상태 버전이 없습니다.');
    const payload = { ...body, requestId: randomUUID(), expectedVersion };
    let result;
    try { result = await this.request(path, payload); }
    catch (error) {
      if (error instanceof ApiFailure) {
        if (error.code === 'VERSION_CONFLICT') await this.snapshot();
        throw error;
      }
      // 전송 결과 불명: 서버 중복 방지를 위해 같은 ID·본문으로 한 번 재시도한다.
      result = await this.request(path, payload);
    }
    this.accept(result.state);
    return this.state;
  }
  async interact(line) {
    const input = line.trim();
    if (!input) return null;
    // 터미널의 실제 입력 경로 전용이다. 자동 snapshot/heartbeat에서 호출하지 않는다.
    await this.request('/v1/sessions/activity', {});
    return input === 'help' ? null : this.execute(input);
  }
  async execute(line) {
    const [name, ...args] = line.trim().split(/\s+/);
    const arity = n => { if (args.length !== n) throw new Error('명령 인수를 확인하세요. help로 사용법을 볼 수 있습니다.'); };
    const battle = (type, extra = {}) => {
      if (!this.state?.battle) throw new Error('참가 중인 전투가 없습니다.');
      return this.command(BATTLE_PATH, { action: { type, battleId: this.state.battle.id, turnId: this.state.battle.turnId, ...extra } });
    };
    if (name === 'state') { arity(0); return this.snapshot(); }
    if (['enter', 'away', 'resume'].includes(name)) { arity(0); return this.command(`/v1/world/${name}`); }
    if (name === 'create') { arity(1); return this.command('/v1/characters/me', { character_name: args[0] }); }
    if (name === 'skill') { arity(1); return this.command('/v1/characters/me/skills', { skill: args[0] }); }
    if (name === 'attribute') { arity(1); return this.command('/v1/characters/me/attributes', { attribute: args[0] }); }
    if (name === 'gate') {
      if (args.length > 1) throw new Error('gate 또는 gate 웨이포인트ID로 입력하세요.');
      if (this.state?.battle) throw new Error('전투 중에는 맵을 이동할 수 없습니다.');
      const position = this.state?.me.position;
      const candidates = (this.state?.map?.connections ?? []).filter(g =>
        g.column === position?.column && g.row === position?.row && (!args.length || g.id === args[0]));
      if (candidates.length !== 1) throw new Error('현재 위치의 웨이포인트를 확인하세요. state에서 ID와 좌표를 볼 수 있습니다.');
      return this.command('/v1/maps/transitions', { connectionId: candidates[0].id });
    }
    if (name === 'encounter') { arity(1); return this.command('/v1/game/encounters/reserve', { monsterId: args[0] }); }
    if (name === 'cancel' || (name === 'ready' && this.state?.reservation)) {
      arity(0);
      if (!this.state?.reservation) throw new Error('조우 예약이 없습니다.');
      return this.command(`/v1/game/encounters/${name}`, { reservationId: this.state.reservation.id });
    }
    if (name === 'move') {
      arity(2);
      if (!args.every(v => /^\d+$/.test(v) && Number.isSafeInteger(Number(v)))) throw new Error('좌표는 0 이상의 정수입니다.');
      const position = { column: Number(args[0]), row: Number(args[1]) };
      return this.state?.battle ? battle('MOVE', { position }) : this.command('/v1/game/moves', { position });
    }
    if (name === 'attack') { arity(1); return battle('ATTACK', { targetId: args[0] }); }
    const actions = { ready: 'READY', end: 'END_TURN', surrender: 'SURRENDER' };
    if (Object.hasOwn(actions, name)) { arity(0); return battle(actions[name]); }
    throw new Error('지원하지 않는 명령입니다. help로 사용법을 확인하세요.');
  }
}

export function formatState(state) {
  const lines = [`${state.me.name ?? '(캐릭터 미생성)'} | ${state.me.mode} | ${state.map?.name ?? ''}`,
    `위치 ${JSON.stringify(state.me.position)} | CP ${state.me.cp} | SP ${state.me.sp ?? '미지원'} | FP ${state.me.fp ?? '미지원'}`];
  if (state.me.lastResult) lines.push(`최근 결과: ${state.me.lastResult.result}`);
  if (state.reservation) lines.push(`조우 예약 ${state.reservation.id}: ready 또는 cancel`);
  if (state.battle) {
    const b = state.battle;
    lines.push(`전투 ${b.id} | ${b.status} | 턴 ${b.turnId} | 현재 ${b.order[b.index]}`);
    for (const u of b.units) lines.push(`${u.id} ${u.name} [${u.side}] (${u.position.column},${u.position.row}) ${u.side === 'enemy' ? (u.healthVisibility === 'BANDED' ? `추정 건강 단계 ${u.hp}/${u.maxHp}` : '체력 정보 없음') : `HP ${u.hp}/${u.maxHp}${Number.isInteger(u.ap) && Number.isInteger(u.maxAp) ? ` | AP ${u.ap}/${u.maxAp}` : ''}`}`);
    lines.push(`이동 가능: ${(b.tactics?.moves ?? []).map(m => `${m.position.column},${m.position.row}${Number.isInteger(m.apCost) ? ` (${m.apCost} AP → 잔여 ${m.apAfter})` : ''}`).join(' / ') || '없음'}`);
    lines.push(`공격 가능: ${(b.tactics?.attacks ?? []).map(a => `${a.targetId}${Number.isInteger(a.apCost) ? ` (${a.apCost} AP)` : ''}`).join(', ') || '없음'}`);
  } else {
    for (const m of state.monsters ?? []) lines.push(`${m.id} ${m.name ?? ''} (${m.position.column},${m.position.row}) ${m.state}`);
    for (const g of state.map?.connections ?? []) lines.push(`웨이포인트 ${g.id} (${g.column},${g.row}) → ${g.targetName ?? g.target}`);
  }
  return lines.join('\n');
}
