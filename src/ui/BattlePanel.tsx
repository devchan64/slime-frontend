import {BorrowedExclusionNotice} from './BorrowedParticipation';
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
import type { Battle, Position } from "../client/types";

type Mode = BattleMode;
const LABELS: Record<string, string> = {
  SKILL: "battle.skills", MOVE: "battle.move", ATTACK: "battle.attack", GUARD: "battle.guard", END_TURN: "battle.endTurn", WAIT: "battle.wait", SURRENDER: "battle.surrenderVote",
};
const same = (a: Position, b: Position | null) => !!b && a.column === b.column && a.row === b.row;
function BattleConfirmation({ title, summary, disabled, close, confirm, confirmButtonLabel, alternateButtonLabel, alternateConfirmAction, alternateActionDisabled }: {
  title: string; summary: string; disabled: boolean; close: () => void; confirm: () => void;
  confirmButtonLabel?: string; alternateButtonLabel?: string; alternateConfirmAction?: () => void; alternateActionDisabled?: boolean;
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
    <p id="battle-confirm-description">{alternateConfirmAction ? t('battle.turnEndPrompt') : summary}</p>
    {alternateConfirmAction ? <>
      <div class="battle-end-options">
        <button class="battle-end-option" disabled={disabled} onClick={() => {
          if (disabled || submitted.current) return;
          submitted.current = true;
          confirm();
        }}><strong>{confirmButtonLabel}</strong><span>{t('battle.plainEndDetail')}</span></button>
        <button class="secondary battle-end-option" disabled={disabled || alternateActionDisabled} onClick={() => {
        if (disabled || alternateActionDisabled || submitted.current) return;
        submitted.current = true;
        alternateConfirmAction();
        }}><strong>{alternateButtonLabel}</strong><span>{t(alternateActionDisabled ? 'battle.guardEndDisabledDetail' : 'battle.guardEndDetail')}</span></button>
      </div>
      <div class="battle-end-footer"><button class="secondary" autoFocus onClick={close}>{t('battle.cancel')}</button></div>
    </> : <div class="battle-confirm-actions">
      <button class="secondary" autoFocus onClick={close}>{t('battle.cancel')}</button>
      <button disabled={disabled} onClick={() => {
        if (disabled || submitted.current) return;
        submitted.current = true;
        confirm();
      }}>{confirmButtonLabel ?? t('battle.confirm')}</button>
    </div>}
  </dialog>;
}

export function BattlePanel({ me, battle, actor, selected, disabled, select, execute, onMode, selectionIntent = 0, monsterLoreLevel = 0 }: {
  me: State["me"]; selectionIntent?: number; battle: Battle; monsterLoreLevel?: number; actor: string; selected: Position | null; disabled: boolean;
  onMode?: (mode: "MOVE" | "ATTACK" | null) => void;
  select: (p: Position | null) => void; execute: (type: string, targetId?: string, selectedActionIdentifier?: string) => void;
}) {
  const { t, locale } = useTranslation();
  battle = localizedBattle(battle, locale);
  const apBattle = battle.rulesVersion === "1.4.0";
  const healthLabel = (unit: Battle["units"][number]) => {
    const display = healthDisplay(unit, monsterLoreLevel);
    return t(display.labelKey, display.values);
  };
  const [mode, setMode] = useState<Mode | null>(() => defaultBattleMode(battle, actor));
  const [idleNotice, setIdleNotice] = useState(false);
  const [surrenderDialogOpen, setSurrenderDialogOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  useEffect(() => { onMode?.(!skillsOpen && (mode === "MOVE" || mode === "ATTACK") ? mode : null); }, [mode, skillsOpen]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); setSurrenderDialogOpen(false); }, [battle.id, battle.turnId, battle.version, battle.status]);
  const lastSelectionIntent = useRef(selectionIntent);
  useEffect(() => {
    if (lastSelectionIntent.current === selectionIntent) return;
    lastSelectionIntent.current = selectionIntent;
    setConfirming(!disabled && mode === "MOVE" && !!selected);
  }, [selectionIntent]);
  const selectAttackTarget = (selectedTargetPosition: Position) => {
    select(selectedTargetPosition);
    setConfirming(false);
  };
  const canActNow = battle.tactics.canAct && battle.order[battle.index] === actor;
  useEffect(() => {
    const next = defaultBattleMode(battle, actor);
    setMode(next); setSurrenderDialogOpen(false); setSkillsOpen(false);
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
    setConfirming(next === "END_TURN");
  };
  if (battle.status === "PREPARING") return <section class="card">
    <BorrowedExclusionNotice currentExcludedEntries={battle.excludedBorrowedParticipants ?? []}/>
    <h3>{t('battle.preparing')}</h3><p>{t('battle.preparingHelp')}</p>
  </section>;
  const player = battle.units.find(u => u.id === actor && u.side === "ally");
  const current = battle.units.find(u => u.id === battle.order[battle.index]);
  const own = battle.tactics.canAct && current?.id === actor;
  const apExhausted = own && battle.status === "ACTIVE" && !!current && (actionPoints(current)?.value ?? 1) <= 0;
  const move = battle.tactics.moves.find(m => same(m.position, selected));
  const target = battle.units.find(u => u.hp > 0 && same(u.position, selected));
  const attack = battle.tactics.attacks.find(a => a.targetId === target?.id);
  const valid = own && mode !== null && (mode === "MOVE" ? !!move : mode === "ATTACK" ? !!attack : true);
  const actionConfirmationVisible = !surrenderDialogOpen && confirming && valid && mode !== null;
  const slottedSkill = selectedSkill && (me.battleSkillLoadout ?? []).includes(selectedSkill) ? selectedSkill : null;
  const skillAction = availableSkillAction(battle, actor, slottedSkill, slottedSkill ? me.skills[slottedSkill] : 0);
  const name = (id: string) => battle.units.find(u => u.id === id)?.name || id;
  return <>
    <BorrowedExclusionNotice currentExcludedEntries={battle.excludedBorrowedParticipants ?? []}/>
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
    {player?.healthRecoveryPending && <p class="battle-action-hint" role="status">{t("battle.recoveryPending")}</p>}
    <p class={`battle-action-hint${apExhausted ? " battle-ap-exhausted" : ""}`} role="status" aria-live="polite">{apExhausted ? t("battle.apExhausted") : !own ? t('battle.waitFor',{name:current?.name ?? t('battle.participant')}) : mode === "MOVE" ? t('battle.moveHint') : mode === "ATTACK" ? t('battle.attackHint') : t('battle.endHint')}</p>
    <div class="battle-button-toolbar">
    <div class="battle-mode-buttons" role="group" aria-label={t('battle.actions')}>
      {(["MOVE", "ATTACK"] as Mode[]).map(value => <button
        class={actionConfirmationVisible && mode === value ? "" : "secondary"} aria-pressed={actionConfirmationVisible && mode === value}
        disabled={disabled || !own || (value === "MOVE" && ((!apBattle && battle.moved) || battle.tactics.moves.length === 0)) || (value === "ATTACK" && ((!apBattle && battle.acted) || battle.tactics.attacks.length === 0))}
        title={value === "ATTACK" && !battle.acted && battle.tactics.attacks.length === 0 ? t('battle.noTarget') : undefined}
        onClick={() => chooseMode(value)}>{t(LABELS[value])}</button>)}
    <div class="battle-skill-column"><button class={skillsOpen ? "" : "secondary"} disabled={disabled || !own}
      aria-expanded={skillsOpen} aria-controls="battle-skill-selection" onClick={() => { setSkillsOpen(!skillsOpen); setConfirming(false); }}>{t("battle.skills")}</button></div>
    </div>
    <div class="battle-end-column"><button class={`${mode === "END_TURN" ? "" : "secondary"}${apExhausted ? " battle-end-suggested" : ""}`}
      aria-pressed={mode === "END_TURN"} disabled={disabled || !own} onClick={() => chooseMode("END_TURN")}>{t('battle.endTurn')}</button></div>
    <div class="battle-submit-row">
      <button class="secondary battle-surrender" disabled={disabled} aria-haspopup="dialog"
        onClick={() => { setConfirming(false); setSurrenderDialogOpen(true); }}>{t('battle.surrender')}</button>
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
      </> : <BattleSkillActionPanel key={`${battle.id}:${battle.version}:${slottedSkill}`} currentBattleState={battle}
        selectedSkillIdentifier={slottedSkill} selectedTargetPosition={selected} currentActionsDisabled={disabled || !own}
        selectTargetPosition={select} executeSkillCommand={execute} /> }
    </section>}
    {!skillsOpen && mode === "ATTACK" && <section class="attack-targets" aria-label={t('battle.targetSelection')}>
      <div class="battle-target-heading"><h4>{t('battle.targetCount',{count:battle.tactics.attacks.length})}</h4>
        {attack && target && <div class="battle-target-actions">
          <button class="secondary compact" onClick={() => { setConfirming(false); select(null); }}>{t('battle.clearSelection')}</button>
          <button class={`compact${actionConfirmationVisible && mode === "ATTACK" ? "" : " secondary"}`} aria-haspopup="dialog" disabled={disabled || !own || (!apBattle && battle.acted)}
            onClick={() => setConfirming(true)}>{t('battle.attack')}</button>
        </div>}
      </div>
      {battle.tactics.attacks.length === 0 && <p>{t('battle.noAttackTargets')}</p>}
      <div class="attack-candidates" aria-label={t('battle.attackCandidates')}>
        {battle.tactics.attacks.map(candidate => {
          const unit = battle.units.find(u => u.id === candidate.targetId)!;
          return <button key={unit.id} class="secondary compact" aria-pressed={target?.id === unit.id}
            disabled={disabled || !own || (!apBattle && battle.acted)}
            onClick={() => selectAttackTarget(unit.position)}>
              <span class="battle-target-name"><strong>{unit.name}</strong>{target?.id === unit.id && <small>{t('battle.selected')}</small>}</span>
              <span class="battle-target-info">{healthLabel(unit)} · {t('battle.expectedDamage',{damage:candidate.damage})}{candidate.apCost !== undefined && current?.ap !== undefined && <> · {t('battle.apPreview',{cost:candidate.apCost,remaining:current.ap-candidate.apCost})}</>}</span>
            </button>;
        })}
      </div>
    </section>}
    {idleNotice && <div class="battle-idle-notice" role="status" aria-live="polite">{t("battle.idleTurnNotice")}</div>}
  </section>
  <section class="card battle-help-card" aria-label={t('battle.help')}>

    {battle.units.some(currentBattleUnit => same(currentBattleUnit.position, selected)) && <BattleUnitDetails unit={battle.units.find(currentBattleUnit => same(currentBattleUnit.position, selected))} monsterLoreLevel={monsterLoreLevel} />}
    {skillsOpen && <p class="battle-context-help">{t('battle.selectSkillHelp')}</p>}
    {!skillsOpen && mode === "ATTACK" && <p class="battle-context-help">{t('battle.attackHelpDetail')}</p>}
    {!skillsOpen && mode !== null && <>
    {mode === "MOVE" && <div class="battle-range-legend" aria-label={t('battle.movementLegend')}>
      <span><i class="range-key range-key-move" aria-hidden="true" />{t('battle.moveTiles')}</span>
      <span><i class="range-key range-key-path" aria-hidden="true">1</i>{t('battle.pathLine')}</span>
      {move && <span><i class="range-key range-key-arrival" aria-hidden="true" />{t('battle.arrivalLine')}</span>}
    </div>}
    <div class="battle-command-content">{mode !== "ATTACK" && <div class="command-preview" aria-live="polite">
      {mode === "MOVE" ? move ? t('battle.moveSummary',{count:move.path.length}) : t('battle.chooseTile')
        : apBattle ? t('battle.turnEndChoice') : battle.acted ? t('battle.endAfterAction') : t('battle.autoGuardHelp')}
    </div>}
    {mode === "MOVE" && move && <div class="arrival-preview" aria-live="polite">

      {battle.acted && !apBattle ? <p>{t('battle.moveEndsTurn')}</p> : <>
        <p>{t('battle.arrivalRange',{range:current?.range?.join('~') ?? ''})}</p>
        {move.attacks.length ? <ul>{move.attacks.map(a => <li>{name(a.targetId)} · {t('battle.expectedDamage',{damage:a.damage})}</li>)}</ul>
          : <p>{t('battle.noArrivalTargets')}</p>}
        <small>{t('battle.moveOnly')}</small>
      </>}
    </div>}
    </div></>}
    <div class="battle-help-sections">
    <section class="battle-status-details" aria-label={t('battle.turnCharacters')}><div class="battle-status">
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

    </div>
    </section>
    <section class="battle-terrain-help"><h4>{t('battle.terrainControls')}</h4><div class="battle-help-content"><TerrainLegend /><p>{t('battle.terrainHelp')}</p></div></section>
    <div class="battle-secondary">
    <section class="battle-roster-details"><h4>{t('battle.unitCount',{count:battle.units.length})}</h4>
    <div class="units" aria-label={t('battle.units')}>
      {battle.units.map(u => <button class="secondary unit-row" disabled={u.hp <= 0} onClick={() => { setConfirming(false); select(u.position); }}>
        <span>{u.side === "ally" ? t('battle.ally') : t('battle.enemy')} · {u.name}</span>
        <span>{healthLabel(u)}{u.guard ? ` · ${t('battle.guard')}` : ""}</span>
      </button>)}
    </div>
    </section>
    <section class="battle-records"><h4>{t('battle.logCount',{count:battle.log.length})}</h4><ol class="battle-log">
      {battle.log.map((event, index) => <li key={`${event.turnId}-${index}`}><span class="battle-log-turn">{t('battle.turnNumber',{turn:event.turnId})} · </span>{name(event.unitId)} · {LABELS[event.action] ? t(LABELS[event.action]) : event.action}
        {event.path?.length ? ` · ${t('battle.logMove',{path:event.path.map(p => `(${p.column}, ${p.row})`).join(' → ')})}` : ""}{event.apCost !== undefined && event.apAfter !== undefined ? ` · ${t('battle.apPreview',{cost:event.apCost,remaining:event.apAfter})}` : ''}{event.movementStopped ? ` · ${t('battle.terrainMovementStopped')}` : ''}{event.autoGuard ? ` · ${t('battle.autoGuard')}` : ""}{event.targetId ? t('battle.logDamage',{name:name(event.targetId),damage:String(event.damage)}) : ""}</li>)}
    </ol>{battle.log.length === 0 && <p>{t('battle.emptyLog')}</p>}</section>

    </div>
    </div>
  </section>
  {surrenderDialogOpen && <BattleConfirmation
    title={t('battle.confirmSurrender')} summary={t('battle.surrenderConfirmation')}
    disabled={disabled} close={() => setSurrenderDialogOpen(false)}
    confirm={() => { setSurrenderDialogOpen(false); execute("SURRENDER"); }} />}
  {actionConfirmationVisible && mode && <BattleConfirmation
    title={t('battle.confirmAction',{action:t(LABELS[mode])})}
    summary={mode === "MOVE" && move ? t('battle.moveRoute',{count:move.cost,path:move.path.map(p => `(${p.column}, ${p.row})`).join(' → ')}) + (move.expectedApCost !== undefined ? ' · ' + t('battle.terrainApPreview',{base:move.apCost!,expected:move.expectedApCost,max:move.maximumApCost!}) : move.apCost !== undefined ? ' · ' + t('battle.apPreview',{cost:move.apCost,remaining:move.apAfter!}) : '')
      : mode === "ATTACK" && target && attack ? `${target.name} · ${t('battle.expectedDamage',{damage:attack.damage})}` + (attack.apCost !== undefined && current?.ap !== undefined ? ' · ' + t('battle.apPreview',{cost:attack.apCost,remaining:current.ap-attack.apCost}) : '')
      : apBattle ? t(current && current.ap !== undefined && current.ap >= 1 ? 'battle.turnEndChoice' : 'battle.guardEndUnavailable') : battle.acted ? t('battle.endNoGuard') : t('battle.endWithGuard')}
    confirmButtonLabel={apBattle && mode === "END_TURN" ? t('battle.plainEndTurn') : undefined}
    alternateButtonLabel={t('battle.guardEndTurn')}
    alternateActionDisabled={!current || current.ap === undefined || current.ap < 1}
    alternateConfirmAction={apBattle && mode === "END_TURN" ? () => { setConfirming(false); execute("GUARD"); } : undefined}
    disabled={disabled || !valid} close={() => setConfirming(false)}
    confirm={() => { setConfirming(false); execute(mode, mode === "ATTACK" ? target?.id : undefined); }} />}
  </>;
}


function BattleSkillActionPanel({currentBattleState, selectedSkillIdentifier, selectedTargetPosition, currentActionsDisabled, selectTargetPosition, executeSkillCommand}: {
  currentBattleState: Battle; selectedSkillIdentifier: string | null; selectedTargetPosition: Position | null; currentActionsDisabled: boolean;
  selectTargetPosition: (selectedTargetPosition: Position | null) => void;
  executeSkillCommand: (selectedCommandType: string, selectedTargetIdentifier?: string, selectedActionIdentifier?: string) => void;
}) {
  const {t} = useTranslation();
  const [selectedActionIdentifier, setSelectedActionIdentifier] = useState<string | null>(null);
  const [skillConfirmationVisible, setSkillConfirmationVisible] = useState(false);
  const currentSkillActions = (currentBattleState.tactics.skillActions ?? []).filter(currentActionEntry => currentActionEntry.skillId === selectedSkillIdentifier);
  const selectedActionEntry = currentSkillActions.find(currentActionEntry => currentActionEntry.actionId === selectedActionIdentifier);
  const selectedTargetUnit = currentBattleState.units.find(currentUnitEntry => same(currentUnitEntry.position, selectedTargetPosition));
  const selectedTargetPreview = selectedActionEntry?.targets.find(currentTargetEntry => currentTargetEntry.targetId === selectedTargetUnit?.id);
  const currentActingUnit = currentBattleState.units.find(currentUnitEntry => currentUnitEntry.id === currentBattleState.order[currentBattleState.index]);
  const currentActionLabel = (currentActionEntry: NonNullable<Battle['tactics']['skillActions']>[number]) =>
    currentActionEntry.actionId === 'one_hand_finishing_strike' ? t('battle.finishingStrike') : currentActionEntry.name;
  return <>
    {!currentSkillActions.length && <p role="status">{t(selectedSkillIdentifier ? 'battle.skillPreviewOnly' : 'battle.selectSkillHelp')}</p>}
    <div class="skill-loadout-options">{currentSkillActions.map(currentActionEntry => <button class="secondary" key={currentActionEntry.actionId}
      disabled={currentActionsDisabled || !currentActionEntry.targets.length} aria-pressed={selectedActionIdentifier === currentActionEntry.actionId}
      title={!currentActionEntry.targets.length ? t('battle.skillUnavailable') : undefined}
      onClick={() => {
        setSelectedActionIdentifier(currentActionEntry.actionId); setSkillConfirmationVisible(false);
        const singleTargetIdentifier = currentActionEntry.targets.length === 1 ? currentActionEntry.targets[0].targetId : null;
        selectTargetPosition(currentBattleState.units.find(currentUnitEntry => currentUnitEntry.id === singleTargetIdentifier)?.position ?? null);
      }}>{currentActionLabel(currentActionEntry)} · {currentActionEntry.apCost} AP</button>)}</div>
    {currentSkillActions.length > 0 && currentSkillActions.every(currentActionEntry => !currentActionEntry.targets.length) && <p role="status">{t('battle.skillUnavailable')}</p>}
    {selectedActionEntry && <section class="attack-targets" aria-label={t('battle.targetSelection')}>
      <div class="battle-target-heading"><h4>{t('battle.targetCount', {count: selectedActionEntry.targets.length})}</h4>
        {selectedTargetPreview && <button class="compact" disabled={currentActionsDisabled} aria-haspopup="dialog"
          onClick={() => setSkillConfirmationVisible(true)}>{t('battle.useSkillAction')}</button>}
      </div>
      <div class="attack-candidates">{selectedActionEntry.targets.map(currentTargetEntry => {
        const currentTargetUnit = currentBattleState.units.find(currentUnitEntry => currentUnitEntry.id === currentTargetEntry.targetId);
        if (!currentTargetUnit) throw new Error('스킬 대상 유닛을 찾을 수 없습니다.');
        return <button class="secondary compact" key={currentTargetEntry.targetId} disabled={currentActionsDisabled}
          aria-pressed={selectedTargetUnit?.id === currentTargetEntry.targetId}
          onClick={() => {selectTargetPosition(currentTargetUnit.position); setSkillConfirmationVisible(false);}}>
          <strong>{currentTargetUnit.name}</strong> · {t('battle.expectedDamage', {damage: currentTargetEntry.damage})}
          {selectedTargetUnit?.id === currentTargetEntry.targetId && <small> · {t('battle.selected')}</small>}
        </button>;
      })}</div>
    </section>}
    {skillConfirmationVisible && selectedActionEntry && selectedTargetPreview && selectedTargetUnit && <BattleConfirmation
      title={t('battle.confirmAction', {action: currentActionLabel(selectedActionEntry)})}
      summary={`${selectedTargetUnit.name} · ${t('battle.expectedDamage', {damage: selectedTargetPreview.damage})} · ${t('battle.apPreview', {cost: selectedActionEntry.apCost, remaining: (currentActingUnit?.ap ?? 0) - selectedActionEntry.apCost})}`}
      disabled={currentActionsDisabled} close={() => setSkillConfirmationVisible(false)}
      confirm={() => {setSkillConfirmationVisible(false); executeSkillCommand('SKILL', selectedTargetUnit.id, selectedActionEntry.actionId);}} />}
  </>;
}
