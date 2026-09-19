import { watchTurnIdle } from "./turnIdleNotice";
import { localizedSkill } from "../client/skillText";
import type { State } from "../client/types";
import { actionPoints } from "./battleActionPoints";
import { localizedBattle } from '../client/monsterText';
import { useTranslation } from '../i18n';
import { BattleUnitDetails } from "./BattleUnitDetails";
import { BattleActionPoints } from "./BattleActionPoints";
import { healthDisplay } from "../game/terrain/healthDisplay";
import { TerrainLegend } from "./TerrainLegend";
import { useEffect, useRef, useState } from "preact/hooks";
import { defaultBattleMode, singleAttackTarget, availableSkillAction, type BattleMode } from "./battleSelection";
import { CharacterPortrait } from "./CharacterPortrait";
import type { Battle, Position } from "../client/types";

const PORTRAITS = {
  slime: new URL("../assets/monsters/slime-v2.png", import.meta.url).href,
  beast: new URL("../assets/monsters/beast-v2.png", import.meta.url).href,
  giant: new URL("../assets/monsters/giant-v2.png", import.meta.url).href,
};
type Mode = BattleMode;
const LABELS: Record<string, string> = {
  MOVE: "battle.move", ATTACK: "battle.attack", GUARD: "battle.guard", END_TURN: "battle.endTurn", WAIT: "battle.wait", SURRENDER: "battle.surrenderVote",
};
const same = (a: Position, b: Position | null) => !!b && a.column === b.column && a.row === b.row;
function BattleConfirmation({ title, summary, disabled, close, confirm }: {
  title: string; summary: string; disabled: boolean; close: () => void; confirm: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} class="battle-confirm-dialog" aria-labelledby="battle-confirm-title" aria-describedby="battle-confirm-description"
    onCancel={event => { event.preventDefault(); close(); }}>
    <h2 id="battle-confirm-title">{title}</h2>
    <p id="battle-confirm-description">{summary}</p>
    <div class="battle-confirm-actions">
      <button class="secondary" autoFocus onClick={close}>{t('battle.cancel')}</button>
      <button disabled={disabled} onClick={() => {
        if (disabled || submitted.current) return;
        submitted.current = true;
        confirm();
      }}>{t('battle.confirm')}</button>
    </div>
  </dialog>;
}

export function BattlePanel({ me, battle, actor, selected, disabled, select, execute, onMode, selectionIntent = 0, monsterLoreLevel = 0 }: {
  me: State["me"]; selectionIntent?: number; battle: Battle; monsterLoreLevel?: number; actor: string; selected: Position | null; disabled: boolean;
  onMode?: (mode: "MOVE" | "ATTACK" | null) => void;
  select: (p: Position | null) => void; execute: (type: string, targetId?: string) => void;
}) {
  const { t, locale } = useTranslation();
  battle = localizedBattle(battle, locale);
  const apBattle = battle.rulesVersion === "1.4.0";
  const healthLabel = (unit: Battle["units"][number]) => {
    const display = healthDisplay(unit, monsterLoreLevel);
    return t(display.labelKey, display.values);
  };
  const [mode, setMode] = useState<Mode | null>(() => defaultBattleMode(battle, actor));
  useEffect(() => { onMode?.(mode === "MOVE" || mode === "ATTACK" ? mode : null); }, [mode]);
  const [idleNotice, setIdleNotice] = useState(false);
  const [surrender, setSurrender] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [battle.id, battle.turnId, battle.version, battle.status]);
  const lastSelectionIntent = useRef(selectionIntent);
  useEffect(() => {
    if (lastSelectionIntent.current === selectionIntent) return;
    lastSelectionIntent.current = selectionIntent;
    setConfirming(!disabled && (mode === "MOVE" || mode === "ATTACK") && !!selected);
  }, [selectionIntent]);
  const chooseTarget = (position: Position) => {
    select(position);
    setConfirming(!disabled && (mode === "MOVE" || mode === "ATTACK"));
  };
  const canActNow = battle.tactics.canAct && battle.order[battle.index] === actor;
  useEffect(() => {
    const next = defaultBattleMode(battle, actor);
    setMode(next); setSurrender(false); setSkillsOpen(false);
    select(next === "ATTACK" ? singleAttackTarget(battle) : null);
  }, [battle.id, battle.turnId, battle.moved, battle.acted, apBattle ? battle.version : null, canActNow, battle.status]);
  useEffect(() => {
    setIdleNotice(false);
    if (!canActNow || disabled || battle.status !== "ACTIVE") return;
    return watchTurnIdle(document, setIdleNotice);
  }, [battle.id, battle.turnId, battle.status, canActNow, disabled]);
  const chooseMode = (next: Mode) => {
    setSkillsOpen(false);
    const automaticTarget = next === "ATTACK" ? singleAttackTarget(battle) : null;
    select(automaticTarget);
    setMode(next);
    setConfirming(next === "END_TURN" || automaticTarget !== null);
  };
  if (battle.status === "PREPARING") return <section class="card">
    <h3>{t('battle.preparing')}</h3><p>{t('battle.preparingHelp')}</p>
  </section>;
  const player = battle.units.find(u => u.id === actor && u.side === "ally");
  const current = battle.units.find(u => u.id === battle.order[battle.index]);
  const own = battle.tactics.canAct && current?.id === actor;
  const apExhausted = own && battle.status === "ACTIVE" && !!current && actionPoints(current)?.value === 0;
  const move = battle.tactics.moves.find(m => same(m.position, selected));
  const target = battle.units.find(u => u.hp > 0 && same(u.position, selected));
  const attack = battle.tactics.attacks.find(a => a.targetId === target?.id);
  const valid = own && mode !== null && (mode === "MOVE" ? !!move : mode === "ATTACK" ? !!attack : true);
  const slottedSkill = selectedSkill && (me.battleSkillLoadout ?? []).includes(selectedSkill) ? selectedSkill : null;
  const skillAction = availableSkillAction(battle, actor, slottedSkill, slottedSkill ? me.skills[slottedSkill] : 0);
  const name = (id: string) => battle.units.find(u => u.id === id)?.name || id;
  return <>
  <section class="card battle-panel battle-control-card" aria-label={t('battle.controls')}>
    <div class="battle-control-heading">
      <span class={`battle-turn-indicator${own ? " is-own-turn" : ""}`}>{own ? t('battle.myTurn') : t('battle.waiting')}</span>
      {player && <div class="battle-player-health" role="status" aria-live="polite" aria-atomic="true">
        <strong>{player.name}</strong><span>HP {player.hp} / {player.maxHp}</span>
        <progress value={player.hp} max={player.maxHp} aria-label={t('battle.healthLabel', {name:player.name})} />
      </div>}
    </div>
<div class="battle-command-area">
    <BattleActionPoints battle={battle} selected={selected} />
    <p class={`battle-action-hint${apExhausted ? " battle-ap-exhausted" : ""}`} role="status" aria-live="polite">{apExhausted ? t("battle.apExhausted") : !own ? t('battle.waitFor',{name:current?.name ?? t('battle.participant')}) : mode === "MOVE" ? t('battle.moveHint') : mode === "ATTACK" ? t('battle.attackHint') : t('battle.endHint')}</p>
    <div class="battle-button-toolbar">
    <div class="battle-mode-buttons" role="group" aria-label={t('battle.actions')}>
      {(["MOVE", "ATTACK"] as Mode[]).map(value => <button
        class={`${mode === value ? "" : "secondary"}${apExhausted && value === "END_TURN" ? " battle-end-suggested" : ""}`} aria-pressed={mode === value}
        disabled={disabled || !own || (value === "MOVE" && ((!apBattle && battle.moved) || battle.tactics.moves.length === 0)) || (value === "ATTACK" && ((!apBattle && battle.acted) || battle.tactics.attacks.length === 0))}
        title={value === "ATTACK" && !battle.acted && battle.tactics.attacks.length === 0 ? t('battle.noTarget') : undefined}
        onClick={() => chooseMode(value)}>{t(LABELS[value])}</button>)}
    </div>
    <div class="battle-skill-column"><button class={skillsOpen ? "" : "secondary"} disabled={disabled || !own}
      aria-expanded={skillsOpen} aria-controls="battle-skill-selection" onClick={() => { setSkillsOpen(!skillsOpen); setConfirming(false); }}>{t("battle.skills")}</button></div>
    <div class="battle-end-column"><button class={`${mode === "END_TURN" ? "" : "secondary"}${apExhausted ? " battle-end-suggested" : ""}`}
      aria-pressed={mode === "END_TURN"} disabled={disabled || !own} onClick={() => chooseMode("END_TURN")}>{t('battle.endTurn')}</button></div>
    <div class="battle-submit-row">
      {surrender ? <>
        <button class="danger" disabled={disabled} onClick={() => { execute("SURRENDER"); setSurrender(false); }}>{t('battle.confirmSurrender')}</button>
        <button class="secondary" onClick={() => setSurrender(false)}>{t('battle.cancel')}</button>
      </> : <>
        <button class="secondary battle-surrender" disabled={disabled} onClick={() => setSurrender(true)}>{t('battle.surrender')}</button>
      </>}
    </div>
    </div>
    </div>
    {skillsOpen && <section id="battle-skill-selection" class="battle-skill-selection" aria-label={t("battle.skillSelection")}>
      <div class="skill-loadout-options">{(me.battleSkillLoadout ?? []).map((id, index) => {
        const definition = me.skillDefinitions?.[id];
        if (!definition) throw new Error(`등록된 스킬 정의가 없습니다: ${id}`);
        const skill = localizedSkill(definition, locale);
        return <button class="secondary" aria-pressed={selectedSkill === id} key={id} disabled={disabled || !own}
          onClick={() => setSelectedSkill(id)}>{index + 1}. {skill.name} · Lv. {me.skills[id]}</button>;
      })}</div>
      {!(me.battleSkillLoadout ?? []).length && <p>{t("battle.noSlottedSkills")}</p>}
      {selectedSkill && (me.battleSkillLoadout ?? []).includes(selectedSkill) && <p>{localizedSkill(me.skillDefinitions![selectedSkill], locale).description}</p>}
      {slottedSkill === "physical_activity" ? <>
        <p role="status">{t("battle.basicAttackSkillHelp")}</p>
        <button disabled={disabled || !skillAction} onClick={() => { if (skillAction) chooseMode(skillAction); }}>{t("battle.attack")}</button>
      </> : <p role="status">{t(slottedSkill ? "battle.skillPreviewOnly" : "battle.selectSkillHelp")}</p>}
    </section>}
    {!skillsOpen && mode === "ATTACK" && <section class="attack-targets" aria-label={t('battle.targetSelection')}>
      <div class="battle-target-heading"><h4>{t('battle.targetCount',{count:battle.tactics.attacks.length})}</h4>
        {attack && target && <button class="secondary compact" onClick={() => { setConfirming(false); select(null); }}>{t('battle.clearSelection')}</button>}
      </div>
      {battle.tactics.attacks.length === 0 && <p>{t('battle.noAttackTargets')}</p>}
      <div class="attack-candidates" aria-label={t('battle.attackCandidates')}>
        {battle.tactics.attacks.map(candidate => {
          const unit = battle.units.find(u => u.id === candidate.targetId)!;
          return <button key={unit.id} class="secondary compact" aria-pressed={target?.id === unit.id}
            disabled={disabled || !own || (!apBattle && battle.acted)}
            onClick={() => chooseTarget(unit.position)}>
              <span class="battle-target-name"><strong>{unit.name}</strong>{target?.id === unit.id && <small>{t('battle.selected')}</small>}</span>
              <span class="battle-target-info">{healthLabel(unit)} · {t('battle.expectedDamage',{damage:candidate.damage})}{candidate.apCost !== undefined && current?.ap !== undefined && <> · {t('battle.apPreview',{cost:candidate.apCost,remaining:current.ap-candidate.apCost})}</>}</span>
            </button>;
        })}
      </div>
    </section>}
    {idleNotice && <div class="battle-idle-notice" role="status" aria-live="polite">{t("battle.idleTurnNotice")}</div>}
  </section>
  <section class="card battle-help-card" aria-label={t('battle.help')}>

    <BattleUnitDetails unit={battle.units.find(u => same(u.position, selected))} monsterLoreLevel={monsterLoreLevel} />
    {mode !== null && <>
    {mode === "MOVE" && <div class="battle-range-legend" aria-label={t('battle.movementLegend')}>
      <span><i class="range-key range-key-move" aria-hidden="true" />{t('battle.moveTiles')}</span>
      <span><i class="range-key range-key-path" aria-hidden="true">1</i>{t('battle.pathLine')}</span>
      {move && <span><i class="range-key range-key-arrival" aria-hidden="true" />{t('battle.arrivalLine')}</span>}
    </div>}
    <div class="battle-command-content">{mode !== "ATTACK" && <div class="command-preview" aria-live="polite">
      {mode === "MOVE" ? move ? t('battle.moveRoute',{count:move.cost,path:move.path.map(p => `(${p.column},${p.row})`).join(' → ')}) : t('battle.chooseTile')
        : battle.acted ? t('battle.endAfterAction') : t('battle.autoGuardHelp')}
    </div>}
    {mode === "MOVE" && move && <div class="arrival-preview" aria-live="polite">
      <strong>{t('battle.arrivalHeading')}</strong>
      {battle.acted && !apBattle ? <p>{t('battle.moveEndsTurn')}</p> : <>
        <p>{t('battle.arrivalRange',{range:current?.range?.join('~') ?? ''})}</p>
        {move.attacks.length ? <ul>{move.attacks.map(a => <li>{name(a.targetId)} · {t('battle.expectedDamage',{damage:a.damage})}</li>)}</ul>
          : <p>{t('battle.noArrivalTargets')}</p>}
        <small>{t('battle.moveOnly')}</small>
      </>}
    </div>}
    </div></>}
    <div class="battle-help-sections">
    <section class="battle-status-details"><h4>{t('battle.turnCharacters')}</h4><div class="battle-status">
    <div class="eyebrow">TURN-BASED TACTICS · {battle.field.columns} × {battle.field.rows}</div>
    <p class="battle-round-summary">{t('battle.roundStatus',{round:battle.round,name:current?.name ?? t('battle.participant')})}</p>
    <div class="turn-order" aria-label={t('battle.turnOrder')}>
      {battle.order.map((id, index) => {
        const u = battle.units.find(unit => unit.id === id)!;
        return <span class={index === battle.index ? "badge current" : "badge"} style={{ opacity: u.hp <= 0 || index < battle.index ? 0.4 : 1 }}>
          {index === battle.index ? "▶ " : ""}{u.name}{u.hp <= 0 ? ` (${t('battle.healthFallen')})` : ""}
        </span>;
      })}
    </div>
    {apBattle ? <p>{t('battle.apRules')}</p> : <p>{t('battle.actionUsage',{move:t(battle.moved ? 'battle.used' : 'battle.once'),action:t(battle.acted ? 'battle.used' : 'battle.once')})}<br />{t('battle.legacyActionHelp')}</p>}
    {current && current.id !== actor && <div class="battle-unit-summary"><div class="battle-portrait">{current.side === "ally" ? <CharacterPortrait /> : <img src={PORTRAITS[current.appearance ?? "slime"]} alt={t('battle.portrait',{name:current.name})} />}</div><div class="current-unit-health"><strong>{current.side === "ally" ? t('battle.ally') : t('battle.enemy')} · {current.name}</strong>{current.side === "ally" ? <><progress value={current.hp} max={current.maxHp} aria-label={t('battle.healthLabel',{name:current.name})} /><small>HP {current.hp} / {current.maxHp}</small></> : <small>{healthLabel(current)}</small>}</div></div>}
    </div>
    </section>
    <section class="battle-terrain-help"><h4>{t('battle.terrainControls')}</h4><div class="battle-help-content"><TerrainLegend /><p>{t('battle.terrainHelp')}</p></div></section>
    <div class="battle-secondary">
    <h4>{t('battle.unitCount',{count:battle.units.length})}</h4>
    <div class="units" aria-label={t('battle.units')}>
      {battle.units.map(u => <button class="secondary unit-row" disabled={u.hp <= 0} onClick={() => chooseTarget(u.position)}>
        <span>{u.side === "ally" ? t('battle.ally') : t('battle.enemy')} · {u.name}</span>
        <span>{healthLabel(u)}{u.guard ? ` · ${t('battle.guard')}` : ""}</span>
      </button>)}
    </div>
    <details class="battle-records"><summary>{t('battle.logCount',{count:battle.log.length})}</summary><ol class="battle-log">
      {battle.log.map((event, index) => <li key={`${event.turnId}-${index}`}><span class="battle-log-turn">{t('battle.turnNumber',{turn:event.turnId})} · </span>{name(event.unitId)} · {LABELS[event.action] ? t(LABELS[event.action]) : event.action}
        {event.path?.length ? ` · ${t('battle.logMove',{path:event.path.map(p => `(${p.column}, ${p.row})`).join(' → ')})}` : ""}{event.autoGuard ? ` · ${t('battle.autoGuard')}` : ""}{event.targetId ? t('battle.logDamage',{name:name(event.targetId),damage:String(event.damage)}) : ""}</li>)}
    </ol>{battle.log.length === 0 && <p>{t('battle.emptyLog')}</p>}</details>

    </div>
    </div>
  </section>
  {confirming && valid && mode && <BattleConfirmation
    title={t('battle.confirmAction',{action:t(LABELS[mode])})}
    summary={mode === "MOVE" && move ? t('battle.moveRoute',{count:move.cost,path:move.path.map(p => `(${p.column}, ${p.row})`).join(' → ')}) + (move.apCost !== undefined ? ' · ' + t('battle.apPreview',{cost:move.apCost,remaining:move.apAfter!}) : '')
      : mode === "ATTACK" && target && attack ? `${target.name} · ${t('battle.expectedDamage',{damage:attack.damage})}` + (attack.apCost !== undefined && current?.ap !== undefined ? ' · ' + t('battle.apPreview',{cost:attack.apCost,remaining:current.ap-attack.apCost}) : '')
      : battle.acted ? t('battle.endNoGuard') : t('battle.endWithGuard')}
    disabled={disabled || !valid} close={() => setConfirming(false)}
    confirm={() => { setConfirming(false); execute(mode, mode === "ATTACK" ? target?.id : undefined); }} />}
  </>;
}
