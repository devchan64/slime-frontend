import type { Position, State } from "../client/types";
import { fieldDistance, fieldRoute, sameCell } from "./fieldNavigation";

type Props = {
  state: State; selected: Position | null; disabled: boolean; now: number;
  select: (position: Position | null) => void;
  command: (path: string, body?: Record<string, unknown>) => unknown;
};
export type Walking = { completed: number; total: number; stopping: boolean };
const NEARBY_LIMIT = 4;
const monsterName = (m: State["monsters"][number]) => m.name ?? (m.appearance ? { slime: "슬라임", beast: "야수", giant: "거인" }[m.appearance] : "몬스터");

export function FieldSelection({ state, selected, disabled, select, command, walking, walk, stop }: Props & {
  walking: Walking | null; walk: () => void; stop: () => void;
}) {
  if (walking) return <section class="field-selection" aria-label="이동 진행">
    <div><strong>{walking.stopping ? "이동을 멈추는 중" : "선택한 위치로 이동 중"}</strong>
      <p role="status">{walking.completed} / {walking.total}칸 이동</p></div>
    <progress value={walking.completed} max={walking.total} aria-label="이동 진행률" />
    <button class="secondary compact" disabled={walking.stopping} onClick={stop}>이동 중지</button>
  </section>;
  if (!selected) return <div class="field-hint">맵의 지형이나 몬스터를 선택해 탐색하세요.</div>;
  const blocked = state.map.blocked.some(p => sameCell(p, selected));
  const path = fieldRoute(state.me.position, selected, state.map);
  const here = sameCell(state.me.position, selected);
  const monsters = state.monsters.filter(m => sameCell(m.position, selected));
  const gate = state.map.connections.find(g => sameCell(g, selected));
  const safe = fieldDistance(state.map.startPoint, selected) <= state.map.safeRadius;
  const field = state.me.mode === "FIELD";
  return <section class="field-selection" aria-label="선택한 위치">
    <div class="field-selection-heading"><div><small>선택 위치 · {selected.column}, {selected.row}</small>
      <h3>{blocked ? "이동 불가 지형" : gate ? `${gate.targetName ?? gate.target} 연결 지점` : monsters.length ? "몬스터 발견" : safe ? "안전 구역" : "탐색 지점"}</h3></div>
      <button class="secondary compact" aria-label="선택 해제" onClick={() => select(null)}>닫기</button></div>
    <p>{blocked ? "바위·수풀·물은 통과할 수 없습니다." : here ? "현재 서 있는 위치입니다." : path ? `걸어서 ${path.length}칸 · 장애물을 피해 이동합니다.` : "현재 위치에서 갈 수 있는 경로가 없습니다."}</p>
    {monsters.map(m => {
      const distance = fieldDistance(state.me.position, m.position);
      return <div class="field-target" key={m.id}><div><strong>{monsterName(m)}</strong>
        <small>{m.disposition === "AGGRESSIVE" ? "선공 · 접근 시 주의" : "비선공"} · {m.state !== "AVAILABLE" ? "현재 조우 불가" : distance > 1 ? "1칸 이내로 접근하면 조우 가능" : "조우 가능"}</small></div>
        <button class="compact" disabled={disabled || !field || m.state !== "AVAILABLE" || distance > 1}
          onClick={() => command("/v1/game/encounters/reserve", { monsterId: m.id })}>조우</button></div>;
    })}
    {!blocked && !here && <button disabled={disabled || !field || !path?.length} onClick={walk}>여기로 이동{path ? ` · ${path.length}칸` : ""}</button>}
    {gate && here && <button disabled={disabled || !field} onClick={() => command("/v1/maps/transitions", { connectionId: gate.id })}>{gate.targetName ?? gate.target}으로 이동 ↗</button>}
    {!field && <small>조우 준비를 완료하거나 취소한 뒤 이동할 수 있습니다.</small>}
  </section>;
}

export function FieldPanel({ state, selected, disabled, now, select, command }: Props) {
  const monsters = [...state.monsters].sort((a, b) => fieldDistance(state.me.position, a.position) - fieldDistance(state.me.position, b.position) || a.id.localeCompare(b.id));
  const renderMonster = (m: State["monsters"][number]) => <button key={m.id}
    class={`field-monster secondary ${selected && sameCell(selected, m.position) ? "is-selected" : ""}`}
    aria-pressed={!!selected && sameCell(selected, m.position)} onClick={() => select(m.position)}>
    <span><strong>{monsterName(m)}</strong><small>{m.disposition === "AGGRESSIVE" ? "선공" : "비선공"} · {m.state === "AVAILABLE" ? "탐색 가능" : "조우 불가"}</small></span>
    <span>{fieldDistance(state.me.position, m.position)}칸 <span aria-hidden="true">›</span></span>
  </button>;
  const reservation = state.reservation;
  return <section class="card field-panel">
    {reservation ? <div class="field-reservation" aria-label="조우 준비">
      <h3>조우 준비</h3><p role="status">준비 {reservation.ready.length}/{reservation.members.length} · 남은 시간 {Math.max(0, Math.ceil(reservation.deadline - now))}초</p>
      <div class="actions"><button disabled={disabled || reservation.ready.includes(state.me.id)} onClick={() => command("/v1/game/encounters/ready", { reservationId: reservation.id })}>{reservation.ready.includes(state.me.id) ? "동료 준비 대기" : "준비 완료"}</button>
      <button class="secondary" disabled={disabled} onClick={() => command("/v1/game/encounters/cancel", { reservationId: reservation.id })}>예약 취소</button></div>
    </div> : <><h3>주변 탐색</h3><p class="field-subtitle">가까운 몬스터부터 표시합니다. 선택하면 맵에서 확인할 수 있습니다.</p></>}
    {monsters.slice(0, NEARBY_LIMIT).map(renderMonster)}
    {monsters.length > NEARBY_LIMIT && <details class="field-details"><summary>나머지 몬스터 {monsters.length - NEARBY_LIMIT}마리</summary>{monsters.slice(NEARBY_LIMIT).map(renderMonster)}</details>}
    {!monsters.length && <p class="field-subtitle">이 맵에는 표시할 몬스터가 없습니다.</p>}
    <details class="field-details"><summary>다른 맵으로 가는 길 · {state.map.connections.length}</summary>
      {state.map.connections.map(g => <button class="field-monster secondary" key={g.id} onClick={() => select(g)}><span>{g.targetName ?? g.target}</span><small>{sameCell(g, state.me.position) ? "현재 위치" : `${fieldDistance(g, state.me.position)}칸`} ↗</small></button>)}
      {!state.map.connections.length && <p>연결된 맵이 없습니다.</p>}
    </details>
  </section>;
}
