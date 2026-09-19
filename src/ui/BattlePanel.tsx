import { BattleActionPoints } from "./BattleActionPoints";
import { healthDisplay } from "../game/terrain/healthDisplay";
import { TerrainLegend } from "./TerrainLegend";
import { useEffect, useState } from "preact/hooks";
import { defaultBattleMode, singleAttackTarget, type BattleMode } from "./battleSelection";
import { CharacterPortrait } from "./CharacterPortrait";
import type { Battle, Position } from "../client/types";

const PORTRAITS = {
  slime: new URL("../assets/monsters/slime-v2.png", import.meta.url).href,
  beast: new URL("../assets/monsters/beast-v2.png", import.meta.url).href,
  giant: new URL("../assets/monsters/giant-v2.png", import.meta.url).href,
};
type Mode = BattleMode;
const LABELS: Record<string, string> = {
  MOVE: "이동", ATTACK: "공격", GUARD: "방어", END_TURN: "턴 종료", WAIT: "시간 초과 대기",
};
const same = (a: Position, b: Position | null) => !!b && a.column === b.column && a.row === b.row;
export function BattlePanel({ battle, actor, selected, disabled, remaining, select, execute, onMode, monsterLoreLevel = 0 }: {
  battle: Battle; monsterLoreLevel?: number; actor: string; selected: Position | null; disabled: boolean; remaining: number;
  onMode?: (mode: "MOVE" | "ATTACK" | null) => void;
  select: (p: Position | null) => void; execute: (type: string, targetId?: string) => void;
}) {
  const [mode, setMode] = useState<Mode | null>(() => defaultBattleMode(battle, actor, remaining));
  useEffect(() => { onMode?.(mode === "MOVE" || mode === "ATTACK" ? mode : null); }, [mode]);
  const [surrender, setSurrender] = useState(false);
  const canActNow = battle.tactics.canAct && battle.order[battle.index] === actor && remaining > 0;
  useEffect(() => {
    const next = defaultBattleMode(battle, actor, remaining);
    setMode(next); setSurrender(false);
    select(next === "ATTACK" ? singleAttackTarget(battle) : null);
  }, [battle.id, battle.turnId, battle.moved, battle.acted, canActNow, battle.status]);
  const chooseMode = (next: Mode) => {
    select(next === "ATTACK" ? singleAttackTarget(battle) : null);
    setMode(next);
  };
  if (battle.status === "PREPARING") return <section class="card">
    <h3>전투 맵 준비 중</h3><p>맵과 전용 채팅룸, 참가자 준비가 완료된 뒤 첫 턴을 시작합니다.</p>
  </section>;
  const current = battle.units.find(u => u.id === battle.order[battle.index]);
  const own = battle.tactics.canAct && current?.id === actor && remaining > 0;
  const move = battle.tactics.moves.find(m => same(m.position, selected));
  const target = battle.units.find(u => u.hp > 0 && same(u.position, selected));
  const attack = battle.tactics.attacks.find(a => a.targetId === target?.id);
  const valid = own && mode !== null && (mode === "MOVE" ? !!move : mode === "ATTACK" ? !!attack : true);
  const selectedTargets = mode === "ATTACK" && target && attack ? [{unit: target, damage: attack.damage}] : [];
  const name = (id: string) => battle.units.find(u => u.id === id)?.name || id;
  return <section class="card battle-panel" aria-label="턴제 전투 명령">
<div class="battle-command-area">
    <BattleActionPoints battle={battle} selected={selected} />
    <p class="battle-step" aria-live="polite">{mode === null ? "1 · 행동 선택" : (mode === "MOVE" || mode === "ATTACK") && !valid ? "2 · 맵에서 대상 선택" : "3 · 결과 확인 후 확정"}</p>
    <div class="actions">
      {(["MOVE", "ATTACK", "END_TURN"] as Mode[]).map(value => <button
        class={mode === value ? "" : "secondary"} aria-pressed={mode === value}
        disabled={disabled || !own || (value === "MOVE" && (battle.moved || battle.tactics.moves.length === 0)) || (value === "ATTACK" && (battle.acted || battle.tactics.attacks.length === 0))}
        title={value === "ATTACK" && !battle.acted && battle.tactics.attacks.length === 0 ? "현재 위치에서 공격 가능한 대상이 없습니다." : undefined}
        onClick={() => chooseMode(value)}>{LABELS[value]}</button>)}
    </div>
    {mode !== null && <><button class="secondary compact" onClick={() => { setMode(null); select(null); }}>← 행동 다시 선택</button>
    <button class="battle-confirm" disabled={disabled || !valid} onClick={() => execute(mode, mode === "ATTACK" ? target?.id : undefined)}>{mode === "END_TURN" && !battle.acted ? "방어하며 턴 종료" : `${LABELS[mode]} 확정`}</button>
    {mode === "MOVE" && <div class="battle-range-legend" aria-label="이동 범위 범례">
      <span><i class="range-key range-key-move" aria-hidden="true" />파란 칸 · 이동 가능</span>
      <span><i class="range-key range-key-path" aria-hidden="true">1</i>번호선 · 선택 경로</span>
      {move && <span><i class="range-key range-key-arrival" aria-hidden="true" />주황 안쪽선 · 도착 후 공격</span>}
    </div>}
    <div class="battle-command-content"><div class="command-preview" aria-live="polite">
      {mode === "MOVE" ? move ? `이동 ${move.cost}셀: ${move.path.map(p => `(${p.column},${p.row})`).join(" → ")}` : "밝은 파란 테두리 안의 칸을 선택하세요."
        : mode === "ATTACK" ? attack && target ? `${target.name} · 예상 피해 ${attack.damage}` : "붉은 테두리의 사거리 내 적을 선택하세요."
        : battle.acted ? "행동을 이미 사용했습니다. 추가 방어 없이 턴을 종료합니다." : "남은 이동을 포기하고 자동 방어합니다. 다음 자기 턴까지 받는 기본 공격 피해가 절반으로 줄어듭니다."}
    </div>
    {mode === "ATTACK" && <section class="attack-targets" aria-label="공격 대상 선택">
      <h4>선택한 몹 · {selectedTargets.length} / 1</h4>
      {selectedTargets.length ? <ul aria-label="선택된 몹 목록">{selectedTargets.map(({unit, damage}) => <li key={unit.id}>
        <div><strong>{unit.name}</strong><small>{healthDisplay(unit, monsterLoreLevel).label} · 예상 피해 {damage}</small></div>
        <button class="secondary compact" aria-label={`${unit.name} 선택 해제`} onClick={() => select(null)}>해제</button>
      </li>)}</ul> : <p>선택한 몹이 없습니다.</p>}
      <p class="field-subtitle">일반 공격은 신체활동 레벨 1에 포함된 스킬이며 한 마리를 선택합니다. 자동 선택해도 확정 전에는 공격하지 않습니다.</p>
      <div class="attack-candidates" aria-label="공격 가능한 몹 목록">
        {battle.tactics.attacks.map(candidate => {
          const unit = battle.units.find(u => u.id === candidate.targetId)!;
          return <button key={unit.id} class="secondary compact" aria-pressed={target?.id === unit.id}
            disabled={disabled || !own || battle.acted}
            onClick={() => select(target?.id === unit.id ? null : unit.position)}>{unit.name}</button>;
        })}
      </div>
    </section>}
    {mode === "MOVE" && move && <div class="arrival-preview" aria-live="polite">
      <strong>도착 후 공격 안내</strong>
      {battle.acted ? <p>행동을 이미 사용했습니다. 이동하면 턴이 종료됩니다.</p> : <>
        <p>주황 안쪽선: 도착 후 공격 범위 · 사거리 {current?.range.join("~")}셀</p>
        {move.attacks.length ? <ul>{move.attacks.map(a => <li>{name(a.targetId)} · 예상 피해 {a.damage}</li>)}</ul>
          : <p>도착 후 공격 가능한 적이 없습니다.</p>}
        <small>이동만 확정합니다. 공격은 도착 후 따로 선택하세요.</small>
      </>}
    </div>}
    </div></>}
    </div>
    <nav class="battle-auxiliary" aria-label="전투 보조 메뉴">
    <details class="battle-status-details"><summary>턴·캐릭터 정보</summary><div class="battle-status">
    <div class="eyebrow">TURN-BASED TACTICS · {battle.field.columns} × {battle.field.rows}</div>
    <h3>라운드 {battle.round} · {current?.name} <span class="timer">{remaining}초</span></h3>
    <p aria-live="polite">{own ? "당신의 차례 · 명령과 대상을 선택한 뒤 확정하세요." : "현재 유닛의 행동을 기다리세요."}</p>
    <div class="turn-order" aria-label="이번 라운드 행동 순서">
      {battle.order.map((id, index) => {
        const u = battle.units.find(unit => unit.id === id)!;
        return <span class={index === battle.index ? "badge current" : "badge"} style={{ opacity: u.hp <= 0 || index < battle.index ? 0.4 : 1 }}>
          {index === battle.index ? "▶ " : ""}{u.name}{u.hp <= 0 ? " (쓰러짐)" : ""}
        </span>;
      })}
    </div>
    <p>이동 {battle.moved ? "사용함" : "1회"} · 행동 {battle.acted ? "사용함" : "1회"}<br />이동과 행동은 순서 자유 · 모두 사용하면 자동 턴 종료</p>
    {current && <div class="battle-unit-summary"><div class="battle-portrait">{current.side === "ally" ? <CharacterPortrait /> : <img src={PORTRAITS[current.appearance ?? "slime"]} alt={`${current.name} 모습`} />}</div><div class="current-unit-health"><strong>{current.side === "ally" ? "아군" : "적군"} · {current.name}</strong>{current.side === "ally" ? <><progress value={current.hp} max={current.maxHp} aria-label={`${current.name} 체력`} /><small>HP {current.hp} / {current.maxHp}</small></> : <small>{healthDisplay(current, monsterLoreLevel).label}</small>}</div></div>}
    </div>
    </details>
    <details class="battle-terrain-help"><summary>지형·조작 안내</summary><div class="battle-help-content"><TerrainLegend /><p>타일을 선택해 이동·공격 대상을 지정하세요. 드래그로 시점을 이동하고 확대·축소 및 회전 버튼으로 지형을 확인하세요.</p><p>파랑: 이동 · 번호선: 경로 · 주황: 도착 후 공격 범위</p></div></details>
    <details class="battle-records"><summary>전투 기록·기권</summary><div class="battle-secondary">
    <details><summary>참가 유닛 · {battle.units.length}</summary>
    <div class="units" aria-label="전투 유닛">
      {battle.units.map(u => <button class="secondary unit-row" disabled={u.hp <= 0} onClick={() => select(u.position)}>
        <span>{u.side === "ally" ? "아군" : "적"} · {u.name}</span>
        <span>{healthDisplay(u, monsterLoreLevel).label}{u.guard ? " · 방어" : ""}</span>
      </button>)}
    </div>
    </details>
    <details><summary>최근 전투 기록</summary><ol class="battle-log">
      {battle.log.slice(-6).map(event => <li>{name(event.unitId)} · {LABELS[event.action] || event.action}
        {event.autoGuard ? " · 자동 방어" : ""}{event.targetId ? ` → ${name(event.targetId)} (${event.damage} 피해)` : ""}</li>)}
    </ol></details>
    <button class="danger" disabled={disabled} onClick={() => {
      if (surrender) { execute("SURRENDER"); setSurrender(false); } else setSurrender(true);
    }}>{surrender ? "기권 동의 확정" : "기권"}</button>
    {surrender && <button class="secondary compact" onClick={() => setSurrender(false)}>기권 취소</button>}
    </div></details>
    </nav>
  </section>;
}
