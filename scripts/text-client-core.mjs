import { randomUUID } from 'node:crypto';

const BATTLE_PATH = '/v1/game/battle/commands';
const SCOUTING_RISK_NAMES = Object.freeze({ LOW: '낮음', EVEN: '대등', HIGH: '높음', VERY_HIGH: '매우 높음', UNKNOWN: '알 수 없음' });
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
  async command(path, body = {}, projectCommandResponse = null) {
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
    return projectCommandResponse ? projectCommandResponse(result) : this.state;
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
    if (name === 'rest') {
      arity(1);
      const requestedRestAction = args[0];
      if (!['start', 'stop'].includes(requestedRestAction)) throw new Error('rest start 또는 rest stop으로 입력하세요.');
      if (this.state?.battle || this.state?.me.mode !== 'FIELD') throw new Error('필드에서만 휴식할 수 있습니다.');
      return this.command('/v1/game/rest/' + requestedRestAction);
    }
    if (name === 'bag') {
      arity(0);
      await this.snapshot();
      return formatCharacterBag(this.state.me.bag);
    }
    if (name === 'first-aid' || name === 'use-item') {
      arity(name === 'first-aid' ? 0 : 1);
      if (this.state?.battle || this.state?.me.mode !== 'FIELD') throw new Error('필드에서만 응급처치·소모품을 사용할 수 있습니다.');
      return name === 'first-aid' ? this.command('/v1/game/skills/first-aid')
        : this.command('/v1/game/consumables/use', { itemId: args[0] });
    }
    if (name === 'scout') {
      arity(1);
      if (this.state?.battle || this.state?.me.mode !== 'FIELD') throw new Error('필드에서만 정찰할 수 있습니다.');
      return this.command('/v1/game/skills/scout', { monsterId: args[0] }, receivedCommandResult =>
        formatScoutingResult(receivedCommandResult.scouting) + '\n' + formatState(this.state));
    }
    if (name === 'journal') {
      arity(0);
      return formatMainEventJournal(await this.request('/v1/game/main-events'));
    }
    if (name === 'loans') {
      if (args.length > 1) throw new Error('loans 또는 loans 다음커서로 입력하세요.');
      return formatBorrowedLoanPage(await this.request('/v1/game/loans' + (args.length ? '?after=' + encodeURIComponent(args[0]) : '')));
    }
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
    if (name === 'use-skill') { arity(2); return battle('SKILL', { actionId: args[0], targetId: args[1] }); }
    if (name === 'attack') { arity(1); return battle('ATTACK', { targetId: args[0] }); }
    const actions = { ready: 'READY', end: 'END_TURN', surrender: 'SURRENDER' };
    if (Object.hasOwn(actions, name)) { arity(0); return battle(actions[name]); }
    throw new Error('지원하지 않는 명령입니다. help로 사용법을 확인하세요.');
  }
}

export function formatState(state) {
  const lines = [`${state.me.name ?? '(캐릭터 미생성)'} | ${state.me.mode} | ${state.map?.name ?? ''}`,
    `위치 ${JSON.stringify(state.me.position)} | CP ${state.me.cp} | SP ${state.me.sp ?? '미지원'} | FP ${state.me.fp ?? '미지원'}`];
  if (Number.isInteger(state.me.hp) && Number.isInteger(state.me.maxHp)) lines.push('HP ' + state.me.hp + '/' + state.me.maxHp);
  if (state.me.healthRecoveryPending) lines.push('전투불능 회복 대기 | 최대 HP 50% 이상 회복 전 이동 불가');
  if (state.me.fieldRest?.active) lines.push('휴식 중 | 분당 HP ' + state.me.fieldRest.recoveryPerMinute + ' 회복 | 중단: rest stop');
  if (state.me.lastResult) lines.push(`최근 결과: ${state.me.lastResult.result}`);
  if (state.reservation) lines.push(`조우 예약 ${state.reservation.id}: ready 또는 cancel`);
  if (state.battle) {
    const b = state.battle;
    lines.push(`전투 ${b.id} | ${b.status} | 턴 ${b.turnId} | 현재 ${b.order[b.index]}`);
    for (const u of b.units) lines.push(`${u.id} ${u.name} [${u.side}] (${u.position.column},${u.position.row}) ${u.side === 'enemy' ? (u.healthVisibility === 'BANDED' ? `추정 건강 단계 ${u.hp}/${u.maxHp}` : '체력 정보 없음') : `HP ${u.hp}/${u.maxHp}${Number.isInteger(u.ap) && Number.isInteger(u.maxAp) ? ` | AP ${u.ap}/${u.maxAp}` : ''}`}`);
    const recoveringBattleUnit = b.units.find(battleUnitEntry => battleUnitEntry.id === state.me.id && battleUnitEntry.healthRecoveryPending);
    if (recoveringBattleUnit) lines.push('전투 이동 불가: 전투불능 회복 대기 · 제자리 행동/턴 종료 가능');
    lines.push(`이동 가능: ${(b.tactics?.moves ?? []).map(m => `${m.position.column},${m.position.row}${Number.isInteger(m.apCost) ? ` (${m.apCost} AP → 잔여 ${m.apAfter})` : ''}`).join(' / ') || '없음'}`);
    lines.push(...formatBattleSkillActions(b.tactics?.skillActions));
    lines.push(`공격 가능: ${(b.tactics?.attacks ?? []).map(a => `${a.targetId}${Number.isInteger(a.apCost) ? ` (${a.apCost} AP)` : ''}`).join(', ') || '없음'}`);
  } else {
    lines.push(...formatPersonalMarkers(state.me.personalMarkers, state.map?.id, state.serverTime));
    for (const m of state.monsters ?? []) lines.push(`${m.id} ${m.name ?? ''} (${m.position.column},${m.position.row}) ${m.state}`);
    for (const g of state.map?.connections ?? []) lines.push(`웨이포인트 ${g.id} (${g.column},${g.row}) → ${g.targetName ?? g.target}`);
  }
  return lines.join('\n');
}


export function formatBorrowedLoanPage(receivedLoanPage) {
  if (!receivedLoanPage || !Number.isFinite(receivedLoanPage.serverTime) || !Array.isArray(receivedLoanPage.entries)
      || !(receivedLoanPage.nextCursor === null || typeof receivedLoanPage.nextCursor === 'string')) {
    throw new Error('대여 목록 응답 형식이 올바르지 않습니다.');
  }
  const renderedLoanLines = receivedLoanPage.entries.map(receivedLoanEntry => {
    if (!receivedLoanEntry || typeof receivedLoanEntry.name !== 'string' || typeof receivedLoanEntry.id !== 'string'
        || !Number.isSafeInteger(receivedLoanEntry.hp) || !Number.isSafeInteger(receivedLoanEntry.maxHp)
        || receivedLoanEntry.hp < 0 || receivedLoanEntry.maxHp <= 0 || receivedLoanEntry.hp > receivedLoanEntry.maxHp
        || ('healthRecoveryPending' in receivedLoanEntry && typeof receivedLoanEntry.healthRecoveryPending !== 'boolean')
        || !Number.isFinite(receivedLoanEntry.expiresAt) || typeof receivedLoanEntry.inBattle !== 'boolean') {
      throw new Error('대여 캐릭터 정보가 올바르지 않습니다.');
    }
    const remainingLoanMinutes = Math.max(0, Math.floor((receivedLoanEntry.expiresAt - receivedLoanPage.serverTime) / 60));
    return receivedLoanEntry.id + ' ' + receivedLoanEntry.name + ' | HP ' + receivedLoanEntry.hp + '/' + receivedLoanEntry.maxHp
      + ' | ' + (receivedLoanEntry.inBattle ? '전투 참가 중' : '대여 유지 중')
      + (receivedLoanEntry.healthRecoveryPending ? ' | 전투불능 회복 대기 · 최대 HP 50% 이상 회복 전 이동 불가' : '')
      + ' | ' + (receivedLoanEntry.expiresAt <= receivedLoanPage.serverTime ? '대여 만료' : '남은 기간 ' + remainingLoanMinutes + '분');
  });
  if (!renderedLoanLines.length) renderedLoanLines.push('대여 중인 파티원이 없습니다.');
  if (receivedLoanPage.nextCursor) renderedLoanLines.push('다음 페이지: loans ' + receivedLoanPage.nextCursor);
  return renderedLoanLines.join('\n');
}


export function formatMainEventJournal(receivedJournalPage) {
  const invalidJournalMessage = '메인 의뢰 기록 응답 형식이 올바르지 않습니다.';
  const isJournalInteger = currentJournalNumber => Number.isSafeInteger(currentJournalNumber) && currentJournalNumber >= 0;
  const isJournalText = currentJournalText => typeof currentJournalText === 'string' && currentJournalText.trim().length > 0;
  const renderJournalText = currentJournalText => currentJournalText.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  if (!receivedJournalPage || !Number.isFinite(receivedJournalPage.serverTime) || receivedJournalPage.serverTime < 0
      || !isJournalInteger(receivedJournalPage.characterVersion) || !Array.isArray(receivedJournalPage.entries)) {
    throw new Error(invalidJournalMessage);
  }
  const seenJournalIdentifiers = new Set();
  const renderedJournalLines = [];
  for (const currentJournalEntry of receivedJournalPage.entries) {
    if (!currentJournalEntry || !isJournalText(currentJournalEntry.eventId) || seenJournalIdentifiers.has(currentJournalEntry.eventId)
        || !isJournalText(currentJournalEntry.title) || !['ACCEPTED', 'COMPLETED'].includes(currentJournalEntry.status)
        || !isJournalInteger(currentJournalEntry.moneyP) || typeof currentJournalEntry.materialsSufficient !== 'boolean'
        || !Number.isFinite(currentJournalEntry.acceptedAt) || currentJournalEntry.acceptedAt < 0
        || (currentJournalEntry.status === 'ACCEPTED' ? currentJournalEntry.completedAt !== null
          : !Number.isFinite(currentJournalEntry.completedAt) || currentJournalEntry.completedAt < currentJournalEntry.acceptedAt)
        || !Array.isArray(currentJournalEntry.items) || !currentJournalEntry.items.length) throw new Error(invalidJournalMessage);
    seenJournalIdentifiers.add(currentJournalEntry.eventId);
    for (const currentNpcRole of ['giver', 'receiver']) {
      if (!currentJournalEntry[currentNpcRole] || !['id', 'name', 'cityId', 'facilityId'].every(
        currentNpcField => isJournalText(currentJournalEntry[currentNpcRole][currentNpcField]))) throw new Error(invalidJournalMessage);
    }
    const seenMaterialIdentifiers = new Set();
    for (const currentMaterialEntry of currentJournalEntry.items) {
      if (!currentMaterialEntry || !isJournalText(currentMaterialEntry.itemId) || seenMaterialIdentifiers.has(currentMaterialEntry.itemId)
          || !isJournalInteger(currentMaterialEntry.required) || !currentMaterialEntry.required || !isJournalInteger(currentMaterialEntry.owned)
          || !isJournalText(currentMaterialEntry.nameTranslations?.ko)) throw new Error(invalidJournalMessage);
      seenMaterialIdentifiers.add(currentMaterialEntry.itemId);
    }
    const expectedMaterialSufficiency = currentJournalEntry.status === 'ACCEPTED'
      && currentJournalEntry.items.every(currentMaterialEntry => currentMaterialEntry.owned >= currentMaterialEntry.required);
    if (currentJournalEntry.materialsSufficient !== expectedMaterialSufficiency) throw new Error(invalidJournalMessage);
    renderedJournalLines.push(renderJournalText(currentJournalEntry.title) + ' [' + (currentJournalEntry.status === 'COMPLETED' ? '완료' : '진행 중') + ']');
    renderedJournalLines.push('수령: ' + renderJournalText(currentJournalEntry.giver.name) + ' → 전달: '
      + renderJournalText(currentJournalEntry.receiver.name) + ' (' + renderJournalText(currentJournalEntry.receiver.cityId)
      + ' / ' + renderJournalText(currentJournalEntry.receiver.facilityId) + ')');
    for (const currentMaterialEntry of currentJournalEntry.items) renderedJournalLines.push('재료: '
      + renderJournalText(currentMaterialEntry.nameTranslations.ko) + ' 현재 ' + currentMaterialEntry.owned + ' / 필요 ' + currentMaterialEntry.required);
    renderedJournalLines.push((currentJournalEntry.status === 'COMPLETED' ? '지급 보상: ' : '완료 보상: ') + currentJournalEntry.moneyP + 'p');
    if (currentJournalEntry.status === 'ACCEPTED') renderedJournalLines.push(currentJournalEntry.materialsSufficient
      ? '재료 충족 · 전달 권한은 별도 확인이 필요합니다.' : '재료가 부족합니다.');
  }
  return renderedJournalLines.join('\n') || '수령한 메인 의뢰가 없습니다.';
}


function formatBattleSkillActions(receivedSkillActions) {
  if (receivedSkillActions === undefined) return [];
  const invalidSkillMessage = '전투 스킬 응답 형식이 올바르지 않습니다.';
  const isSkillText = receivedSkillText => typeof receivedSkillText === 'string' && receivedSkillText.trim().length > 0;
  const renderSkillText = receivedSkillText => receivedSkillText.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  if (!Array.isArray(receivedSkillActions)) throw new Error(invalidSkillMessage);
  const seenActionIdentifiers = new Set();
  return receivedSkillActions.map(receivedSkillAction => {
    if (!receivedSkillAction || !isSkillText(receivedSkillAction.actionId) || !isSkillText(receivedSkillAction.name)
        || !Number.isSafeInteger(receivedSkillAction.apCost) || receivedSkillAction.apCost < 0
        || !Array.isArray(receivedSkillAction.targets) || seenActionIdentifiers.has(receivedSkillAction.actionId)) {
      throw new Error(invalidSkillMessage);
    }
    seenActionIdentifiers.add(receivedSkillAction.actionId);
    const seenTargetIdentifiers = new Set();
    const renderedSkillTargets = receivedSkillAction.targets.map(receivedSkillTarget => {
      if (!receivedSkillTarget || !isSkillText(receivedSkillTarget.targetId)
          || !Number.isSafeInteger(receivedSkillTarget.damage) || receivedSkillTarget.damage < 0
          || seenTargetIdentifiers.has(receivedSkillTarget.targetId)) throw new Error(invalidSkillMessage);
      seenTargetIdentifiers.add(receivedSkillTarget.targetId);
      return renderSkillText(receivedSkillTarget.targetId) + ' (예상 피해 ' + receivedSkillTarget.damage + ')';
    });
    return '전투 스킬 ' + renderSkillText(receivedSkillAction.name) + ' [' + renderSkillText(receivedSkillAction.actionId)
      + '] | ' + receivedSkillAction.apCost + ' AP | 대상: ' + (renderedSkillTargets.join(', ') || '없음')
      + (renderedSkillTargets.length ? ' | 사용: use-skill ' + renderSkillText(receivedSkillAction.actionId) + ' 대상ID' : ' (현재 사용 불가)');
  });
}



export function formatScoutingResult(receivedScoutingResult) {
  const invalidScoutingMessage = '정찰 응답 형식이 올바르지 않습니다.';
  const renderScoutingText = receivedScoutingText => receivedScoutingText.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  if (!receivedScoutingResult || typeof receivedScoutingResult.monsterId !== 'string' || !receivedScoutingResult.monsterId
      || typeof receivedScoutingResult.mapId !== 'string' || !receivedScoutingResult.mapId
      || typeof receivedScoutingResult.succeeded !== 'boolean'
      || !Number.isFinite(receivedScoutingResult.observedAt) || receivedScoutingResult.observedAt < 0
      || !Number.isFinite(receivedScoutingResult.expiresAt) || receivedScoutingResult.expiresAt <= receivedScoutingResult.observedAt
      || !Number.isSafeInteger(receivedScoutingResult.fpCost) || receivedScoutingResult.fpCost < 1) throw new Error(invalidScoutingMessage);
  const expectedScoutingFields = ['monsterId', 'mapId', 'succeeded', 'observedAt', 'expiresAt', 'fpCost',
    ...(receivedScoutingResult.succeeded ? ['countBand',
      ...(receivedScoutingResult.riskGrade !== undefined || receivedScoutingResult.riskVersion !== undefined ? ['riskGrade', 'riskVersion'] : [])] : [])];
  if (Object.keys(receivedScoutingResult).sort().join() !== expectedScoutingFields.sort().join()) throw new Error(invalidScoutingMessage);
  const renderedScoutingHeader = '정찰 ' + renderScoutingText(receivedScoutingResult.monsterId) + ' | '
    + (receivedScoutingResult.succeeded ? '성공' : '실패') + ' | 소비 FP ' + receivedScoutingResult.fpCost;
  if (!receivedScoutingResult.succeeded) return renderedScoutingHeader;
  const receivedCountRange = receivedScoutingResult.countBand;
  if (!receivedCountRange || Object.keys(receivedCountRange).sort().join() !== 'maximumCount,minimumCount' || !Number.isSafeInteger(receivedCountRange.minimumCount) || receivedCountRange.minimumCount < 1
      || (receivedCountRange.maximumCount !== null && (!Number.isSafeInteger(receivedCountRange.maximumCount)
        || receivedCountRange.maximumCount < receivedCountRange.minimumCount))) throw new Error(invalidScoutingMessage);
  const hasScoutingRisk = receivedScoutingResult.riskGrade !== undefined || receivedScoutingResult.riskVersion !== undefined;
  if (hasScoutingRisk && (receivedScoutingResult.riskVersion !== 1
      || !Object.hasOwn(SCOUTING_RISK_NAMES, receivedScoutingResult.riskGrade))) throw new Error(invalidScoutingMessage);
  const renderedCountRange = receivedCountRange.maximumCount === null ? receivedCountRange.minimumCount + '마리 이상'
    : receivedCountRange.minimumCount === receivedCountRange.maximumCount ? receivedCountRange.minimumCount + '마리'
    : receivedCountRange.minimumCount + '~' + receivedCountRange.maximumCount + '마리';
  return renderedScoutingHeader + ' | 관측 인원 ' + renderedCountRange
    + (hasScoutingRisk ? ' | 위험도 ' + SCOUTING_RISK_NAMES[receivedScoutingResult.riskGrade] : '')
    + ' | 관측 시각 ' + receivedScoutingResult.observedAt + ' | 만료 시각 ' + receivedScoutingResult.expiresAt + ' (Unix 초)';
}


export function formatCharacterBag(receivedCharacterBag) {
  if (receivedCharacterBag === undefined) return '현재 서버 응답에 가방 정보가 없습니다.';
  const invalidBagMessage = '가방 응답 형식이 올바르지 않습니다.';
  const renderBagText = receivedBagText => receivedBagText.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  if (!receivedCharacterBag || !Array.isArray(receivedCharacterBag.items)) throw new Error(invalidBagMessage);
  const seenBagIdentifiers = new Set();
  const renderedBagLines = receivedCharacterBag.items.map(receivedBagItem => {
    if (!receivedBagItem || typeof receivedBagItem.id !== 'string' || !receivedBagItem.id
        || typeof receivedBagItem.name !== 'string' || !receivedBagItem.name
        || !['material', 'consumable', 'skillbook'].includes(receivedBagItem.kind)
        || !Number.isSafeInteger(receivedBagItem.quantity) || receivedBagItem.quantity < 1
        || seenBagIdentifiers.has(receivedBagItem.id)) throw new Error(invalidBagMessage);
    seenBagIdentifiers.add(receivedBagItem.id);
    let renderedUseCommand = '';
    if (receivedBagItem.useAction !== undefined) {
      const receivedUseAction = receivedBagItem.useAction;
      if (receivedBagItem.kind !== 'consumable' || !receivedUseAction
          || !Number.isSafeInteger(receivedUseAction.consumedOnSuccess) || receivedUseAction.consumedOnSuccess < 1) throw new Error(invalidBagMessage);
      let renderedItemEffect = '';
      if (receivedUseAction.type === 'RESTORE_HP') {
        if (!Number.isSafeInteger(receivedUseAction.restorationHp) || receivedUseAction.restorationHp < 1
            || Object.keys(receivedUseAction).sort().join() !== 'consumedOnSuccess,restorationHp,type') throw new Error(invalidBagMessage);
        renderedItemEffect = 'HP 회복 ' + receivedUseAction.restorationHp;
      } else if (receivedUseAction.type === 'PLACE_MARKER') {
        if (!['ROUTE', 'LIGHT'].includes(receivedUseAction.markerKind)
            || !Number.isSafeInteger(receivedUseAction.validSeconds) || receivedUseAction.validSeconds < 1
            || Object.keys(receivedUseAction).sort().join() !== 'consumedOnSuccess,markerKind,type,validSeconds') throw new Error(invalidBagMessage);
        renderedItemEffect = (receivedUseAction.markerKind === 'ROUTE' ? '경로' : '광원') + ' 표식 ' + receivedUseAction.validSeconds + '초 · 현재 타일 설치';
      } else throw new Error(invalidBagMessage);
      renderedUseCommand = ' | ' + renderedItemEffect + ' · 소비 ' + receivedUseAction.consumedOnSuccess
        + '개 | 사용: use-item ' + renderBagText(receivedBagItem.id);
    }
    return renderBagText(receivedBagItem.name) + ' [' + renderBagText(receivedBagItem.id) + '] × ' + receivedBagItem.quantity + renderedUseCommand;
  });
  return renderedBagLines.length ? renderedBagLines.join('\n') : '가방이 비어 있습니다.';
}


function formatPersonalMarkers(receivedPersonalMarkers, currentMapIdentifier, observedServerTime) {
  if (receivedPersonalMarkers === undefined) return [];
  const invalidMarkerMessage = '개인 표식 응답 형식이 올바르지 않습니다.';
  if (!Array.isArray(receivedPersonalMarkers)) throw new Error(invalidMarkerMessage);
  if (!receivedPersonalMarkers.length) return [];
  if (!Number.isFinite(observedServerTime) || observedServerTime < 0 || typeof currentMapIdentifier !== 'string') throw new Error(invalidMarkerMessage);
  const seenMarkerIdentifiers = new Set();
  const renderedMarkerLines = [];
  for (const receivedPersonalMarker of receivedPersonalMarkers) {
    if (!receivedPersonalMarker || typeof receivedPersonalMarker.id !== 'string' || !receivedPersonalMarker.id
        || seenMarkerIdentifiers.has(receivedPersonalMarker.id) || typeof receivedPersonalMarker.mapId !== 'string'
        || !['ROUTE', 'LIGHT'].includes(receivedPersonalMarker.kind)
        || !Number.isSafeInteger(receivedPersonalMarker.position?.column) || receivedPersonalMarker.position.column < 0
        || !Number.isSafeInteger(receivedPersonalMarker.position?.row) || receivedPersonalMarker.position.row < 0
        || !Number.isFinite(receivedPersonalMarker.createdAt) || receivedPersonalMarker.createdAt < 0
        || !Number.isFinite(receivedPersonalMarker.expiresAt) || receivedPersonalMarker.expiresAt <= receivedPersonalMarker.createdAt) throw new Error(invalidMarkerMessage);
    seenMarkerIdentifiers.add(receivedPersonalMarker.id);
    if (receivedPersonalMarker.mapId !== currentMapIdentifier || receivedPersonalMarker.expiresAt <= observedServerTime) continue;
    renderedMarkerLines.push('개인 ' + (receivedPersonalMarker.kind === 'ROUTE' ? '경로' : '광원') + ' 표식 ('
      + receivedPersonalMarker.position.column + ',' + receivedPersonalMarker.position.row + ') | 만료 시각 '
      + receivedPersonalMarker.expiresAt + ' (Unix 초, 서버 시각 ' + observedServerTime + ' 기준)');
  }
  return renderedMarkerLines;
}
