import { heightAt } from "../game/terrain/elevation";
import { useTranslation } from '../i18n';
import { localizedFieldMap } from '../client/mapText';
import type { Position, State } from "../client/types";
import { encounterRoute, fieldDistance, fieldRoute, sameCell } from "./fieldNavigation";

type Props = {
  state: State; selected: Position | null; disabled: boolean; now: number;
  select: (position: Position | null) => void;
  command: (path: string, body?: Record<string, unknown>) => unknown;
};
export type Walking = { completed: number; total: number; stopping: boolean };
const NEARBY_LIMIT = 4;
const monsterName = (m: State["monsters"][number]) => m.name ?? (m.appearance ? { slime: "슬라임", beast: "야수", giant: "거인" }[m.appearance] : "몬스터");

export function FieldSelection({ state, selected, disabled, select, command, walking, walk, stop, encounter, disabledReason }: Props & {
  walking: Walking | null; walk: () => void; stop: () => void; encounter?: (monsterId: string) => void; disabledReason?: string;
}) {
  const { locale } = useTranslation();
  state = {...state, map: localizedFieldMap(state.map, locale)};
  const debt = state.me.fp !== undefined && state.me.fp < 0;
  const canStep = state.me.fp === undefined || state.me.fp >= 1;
  disabled = disabled || debt;
  if (debt) disabledReason = "FP가 음수여서 필드 행동을 할 수 없습니다. 충전을 기다려 주세요.";
  if (walking) return <section class="field-selection field-walking" aria-label="이동 진행">
    <div class="field-selection-heading"><div><span class="field-kicker">이동 중</span>
      <h3>{walking.stopping ? "이동을 멈추는 중" : "목적지로 이동하고 있어요"}</h3></div>
      <button class="secondary compact" disabled={walking.stopping} onClick={stop}>{walking.stopping ? "중지 요청됨" : "이동 중지"}</button></div>
    <p role="status">{walking.completed} / {walking.total}칸 이동 · {walking.stopping ? "진행 중인 한 칸을 마치면 멈춥니다." : "언제든 이동을 중지할 수 있어요."}</p>
    <progress value={walking.completed} max={walking.total} aria-label="이동 진행률" />
  </section>;
  if (!selected) {
    const nearby = [...state.monsters].filter(m => m.state === "AVAILABLE")
      .sort((a,b) => fieldDistance(state.me.position,a.position)-fieldDistance(state.me.position,b.position)).slice(0,3);
    return <section class="field-selection field-idle" aria-label="타일 명령">
      <div class="field-selection-heading"><div><span class="field-kicker">주변 둘러보기</span><h3>어디로 떠날까요?</h3></div>
        <span class="field-selection-hint">타일 선택 → 행동 확인</span></div>
      <div class="field-quick-targets">{nearby.map(m => <button class="secondary" key={m.id} onClick={() => select(m.position)}>
        <span class={`field-disposition ${m.disposition === "AGGRESSIVE" ? "is-aggressive" : ""}`}>{m.disposition === "AGGRESSIVE" ? "! 선공" : "비선공"}</span>
        <strong>{monsterName(m)}</strong><small>{fieldDistance(state.me.position,m.position) <= 1 ? "인접 · 조우 가능" : `격자 거리 ${fieldDistance(state.me.position,m.position)}칸`} <span aria-hidden="true">→</span></small>
      </button>)}</div>
      {!nearby.length && <p>주변에 조우 가능한 몬스터가 없습니다. 타일이나 웨이포인트를 선택해 탐색하세요.</p>}
    </section>;
  }
  const blocked = state.map.blocked.some(p => sameCell(p, selected));
  const path = fieldRoute(state.me.position, selected, state.map);
  const here = sameCell(state.me.position, selected);
  const monsters = state.monsters.filter(m => m.state !== "COOLDOWN" && sameCell(m.position, selected));
  const gate = state.map.connections.find(g => sameCell(g, selected));
  const safe = fieldDistance(state.map.startPoint, selected) <= state.map.safeRadius;
  const field = state.me.mode === "FIELD";
  const unavailable = !field ? "조우 준비를 완료하거나 취소한 뒤 이동할 수 있습니다." : disabled ? disabledReason ?? "요청 처리 중에는 행동할 수 없습니다." : null;
  return <section class="field-selection" aria-label="선택한 위치">
    <div class="field-selection-heading"><div><span class="field-kicker">{monsters.length ? "대상 확인" : "목적지 확인"}</span>
      <h3>{monsters.length ? "몬스터 조우" : blocked ? "이동 불가 지형" : gate ? `${gate.targetName ?? gate.target} 연결 지점` : here ? "현재 위치" : safe ? "안전 구역" : "탐색 지점"}</h3></div>
      <button class="secondary compact" aria-label="선택 해제" onClick={() => select(null)}>해제</button></div>
    <div class="field-command-body">
      {monsters.map(m => {
        const distance = fieldDistance(state.me.position, m.position);
        const route = encounterRoute(state.me.position, m.position, state.map);
        return <div class="field-target" key={m.id}><div>
          <span class={`field-disposition ${m.disposition === "AGGRESSIVE" ? "is-aggressive" : ""}`}>{m.disposition === "AGGRESSIVE" ? "! 선공 · 접근 주의" : "비선공"}</span>
          <strong>{monsterName(m)}</strong>
          <small>{m.state !== "AVAILABLE" ? "다른 조우가 진행 중입니다." : distance > 1 ? route ? `인접 위치까지 ${route.length}칸 · ${route.length} FP` : "접근 가능한 경로가 없습니다." : "인접 · 바로 조우할 수 있어요"}</small></div>
          <button class="compact" disabled={disabled || !field || m.state !== "AVAILABLE" || (distance > 1 && (!route || !encounter || !canStep))}
            onClick={() => distance > 1 ? encounter?.(m.id) : command("/v1/game/encounters/reserve", { monsterId: m.id })}>{distance > 1 ? "접근 후 조우" : "조우 시작"}</button></div>;
      })}
      {!monsters.length && <p class={`field-route-summary ${blocked || !path ? "is-warning" : ""}`}>
        {blocked ? "바위·수풀·물은 통과할 수 없습니다. 다른 타일을 선택하세요." : here ? gate ? "연결 지점에 도착했습니다. 다음 맵으로 이동할 수 있어요." : "현재 서 있는 위치입니다. 다른 타일을 선택하세요." : path ? gate ? `연결 지점까지 ${path.length}칸 · 도착 후 맵 이동을 선택하세요.` : `걸어서 ${path.length}칸 · 길과 계단을 따라 이동합니다.` : "현재 위치에서 갈 수 있는 경로가 없습니다. 다른 지점을 선택하세요."}
      </p>}
      {!canStep && !debt && !here && <p class="field-unavailable" role="status">이동에는 1칸당 1 FP가 필요합니다. 충전을 기다려 주세요.</p>}
      {unavailable && <p class="field-unavailable" role="status">{unavailable}</p>}
      <details class="tile-description"><summary>좌표·지형 상세</summary><small>좌표 {selected.column}, {selected.row} · 높이 {heightAt(selected, state.map)}</small></details>
    </div>
    {!monsters.length && <div class="field-tile-actions">{!blocked && !here && <button disabled={disabled || !field || !path?.length || !canStep} onClick={walk}>{gate ? "연결 지점으로 이동" : "여기로 이동"}{path ? ` · ${path.length}칸 / ${path.length} FP` : ""}</button>}
      {gate && here && <button disabled={disabled || !field} onClick={() => command("/v1/maps/transitions", { connectionId: gate.id })}>{gate.targetName ?? gate.target}으로 이동 ↗</button>}
    </div>}
  </section>;
}

export function FieldPanel({ state, selected, disabled, now, select, command }: Props) {
  const { locale } = useTranslation();
  state = {...state, map: localizedFieldMap(state.map, locale)};
  const monsters = state.monsters.filter(m => m.state !== "COOLDOWN").sort((a, b) => fieldDistance(state.me.position, a.position) - fieldDistance(state.me.position, b.position) || a.id.localeCompare(b.id));
  const renderMonster = (m: State["monsters"][number]) => <button key={m.id}
    class={`field-monster secondary ${selected && sameCell(selected, m.position) ? "is-selected" : ""}`}
    aria-pressed={!!selected && sameCell(selected, m.position)} onClick={() => select(m.position)}>
    <span><strong>{monsterName(m)}</strong><small>{m.disposition === "AGGRESSIVE" ? "선공" : "비선공"} · {m.state === "AVAILABLE" ? "탐색 가능" : "조우 불가"}</small></span>
    <span>격자 거리 {fieldDistance(state.me.position, m.position)}칸 <span aria-hidden="true">›</span></span>
  </button>;
  const reservation = state.reservation;
  return <section class="card field-panel">
    {reservation ? <div class="field-reservation" aria-label="조우 준비">
      <h3>조우 준비</h3><p role="status">준비 {reservation.ready.length}/{reservation.members.length} · 남은 시간 {Math.max(0, Math.ceil(reservation.deadline - now))}초</p>
      <div class="actions"><button disabled={disabled || (state.me.fp !== undefined && state.me.fp < 0) || reservation.ready.includes(state.me.id)} onClick={() => command("/v1/game/encounters/ready", { reservationId: reservation.id })}>{reservation.ready.includes(state.me.id) ? "동료 준비 대기" : "준비 완료"}</button>
      <button class="secondary" disabled={disabled} onClick={() => command("/v1/game/encounters/cancel", { reservationId: reservation.id })}>예약 취소</button></div>
    </div> : <><h3>주변 탐색</h3><p class="field-subtitle">가까운 몬스터부터 표시합니다. 선택하면 맵에서 확인할 수 있습니다.</p></>}
    {monsters.slice(0, NEARBY_LIMIT).map(renderMonster)}
    {monsters.length > NEARBY_LIMIT && <details class="field-details"><summary>나머지 몬스터 {monsters.length - NEARBY_LIMIT}마리</summary>{monsters.slice(NEARBY_LIMIT).map(renderMonster)}</details>}
    {!monsters.length && <p class="field-subtitle">이 맵에는 표시할 몬스터가 없습니다.</p>}
    <details class="field-details"><summary>다른 맵으로 가는 길 · {state.map.connections.length}</summary>
      {state.map.connections.map(g => <button class="field-monster secondary" key={g.id} onClick={() => select(g)}><span>{g.targetName ?? g.target}</span><small>{sameCell(g, state.me.position) ? "현재 위치" : `격자 거리 ${fieldDistance(g, state.me.position)}칸`} ↗</small></button>)}
      {!state.map.connections.length && <p>연결된 맵이 없습니다.</p>}
    </details>
  </section>;
}
