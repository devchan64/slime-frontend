import { localizedMonster } from '../client/monsterText';
import { heightAt } from "../game/terrain/elevation";
import { t, useTranslation } from '../i18n';
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
const monsterName = (m: State["monsters"][number]) => m.name ?? t(m.appearance ? `field.legacy${m.appearance}` : 'field.monster');


const EVENT_SHORTCUT_LIMIT = 3;
export function FieldEventShortcuts({ state, selected, select, disabled }: Pick<Props, "state" | "selected" | "select" | "disabled">) {
  const { t, locale } = useTranslation();
  const map = localizedFieldMap(state.map, locale);
  const events = [
    ...state.monsters.filter(monster => monster.state === "AVAILABLE").map(monster => ({
      id: `monster:${monster.id}`, position: monster.position, name: monsterName(localizedMonster(monster, locale)),
      kind: monster.disposition === "AGGRESSIVE" ? t('field.aggressiveMonster') : t('field.passiveMonster'),
    })),
    ...map.connections.map(gate => ({
      id: `connection:${gate.id}`, position: gate, name: gate.targetName ?? gate.target, kind: t('field.mapConnection'),
    })),
  ].map(event => ({ ...event, distance: fieldDistance(state.me.position, event.position) }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, EVENT_SHORTCUT_LIMIT);
  return <nav class="field-event-shortcuts" aria-label={t('field.nearbyEvents')}>
    {events.map(event => <button key={event.id} class="secondary" disabled={disabled}
      aria-pressed={!!selected && sameCell(event.position, selected)}
      onClick={() => select(event.position)}>
      <small>{event.kind}</small><strong>{event.name}</strong><small>{t('field.gridDistance',{count:event.distance})}</small>
    </button>)}
    {!events.length && <p>{t('field.noEvents')}</p>}
  </nav>;
}

export function FieldSelection({ state, selected, disabled, select, command, walking, walk, stop, encounter, disabledReason }: Props & {
  walking: Walking | null; walk: () => void; stop: () => void; encounter?: (monsterId: string) => void; disabledReason?: string;
}) {
  const { t, locale } = useTranslation();
  state = {...state, map: localizedFieldMap(state.map, locale)};
  const debt = state.me.fp !== undefined && state.me.fp < 0;
  const canStep = state.me.fp === undefined || state.me.fp >= 1;
  disabled = disabled || debt;
  if (debt) disabledReason = t('field.debtHelp');
  if (walking) return <section class="field-selection field-walking" aria-label={t('field.walkingProgress')}>
    <div class="field-selection-heading"><div><span class="field-kicker">{t('field.walking')}</span>
      <h3>{walking.stopping ? t('field.stopping') : t('field.walkingHeading')}</h3></div>
      <button class="secondary compact" disabled={walking.stopping} onClick={stop}>{walking.stopping ? t('field.stopRequested') : t('field.stop')}</button></div>
    <p role="status">{t('field.walked',{completed:walking.completed,total:walking.total})} · {walking.stopping ? t('field.stopAfterTile') : t('field.stopAnytime')}</p>
    <progress value={walking.completed} max={walking.total} aria-label={t('field.progressLabel')} />
  </section>;
  if (!selected) {
    return <section class="field-selection field-idle" aria-label={t('field.tileCommands')}>
      <div class="field-selection-heading"><div><span class="field-kicker">{t('field.explore')}</span><h3>{t('field.whereTo')}</h3></div>
        <span class="field-selection-hint">{t('field.selectHint')}</span></div>
    </section>;
  }
  const blocked = state.map.blocked.some(p => sameCell(p, selected));
  const path = fieldRoute(state.me.position, selected, state.map);
  const here = sameCell(state.me.position, selected);
  const monsters = state.monsters.filter(m => m.state !== "COOLDOWN" && sameCell(m.position, selected));
  const gate = state.map.connections.find(g => sameCell(g, selected));
  const safe = fieldDistance(state.map.startPoint, selected) <= state.map.safeRadius;
  const field = state.me.mode === "FIELD";
  const unavailable = !field ? t('field.finishPreparation') : disabled ? disabledReason ?? t('field.busy') : null;
  return <section class="field-selection" aria-label={t('field.selectedLocation')}>
    <div class="field-selection-heading"><div><span class="field-kicker">{monsters.length ? t('field.targetHeading') : t('field.locationHeading')}</span>
      <h3>{monsters.length ? t('field.monsterEncounter') : blocked ? t('field.blockedTerrain') : gate ? t('field.destinationHeading', {name:gate.targetName ?? gate.target}) : here ? t('field.currentPosition') : safe ? t('field.safeArea') : t('field.explorationPoint')}</h3></div>
      <button class="secondary compact" aria-label={t('field.clearSelection')} onClick={() => select(null)}>{t('field.clear')}</button></div>
    <div class="field-command-body">
      {monsters.map(m => {
        const distance = fieldDistance(state.me.position, m.position);
        const route = encounterRoute(state.me.position, m.position, state.map);
        return <div class="field-target" key={m.id}><div>
          <span class={`field-disposition ${m.disposition === "AGGRESSIVE" ? "is-aggressive" : ""}`}>{m.disposition === "AGGRESSIVE" ? t('field.aggressiveWarning') : t('field.passive')}</span>
          <strong>{monsterName(localizedMonster(m, locale))}</strong>
          <small>{m.state !== "AVAILABLE" ? t('field.encounterBusy') : distance > 1 ? route ? t('field.approachCost',{count:route.length}) : t('field.noApproach') : t('field.adjacent')}</small></div>
          <button class="compact" disabled={disabled || !field || m.state !== "AVAILABLE" || (distance > 1 && (!route || !encounter || !canStep))}
            onClick={() => distance > 1 ? encounter?.(m.id) : command("/v1/game/encounters/reserve", { monsterId: m.id })}>{distance > 1 ? t('field.approachEncounter') : t('field.startEncounter')}</button></div>;
      })}
      {!monsters.length && <p class={`field-route-summary ${blocked || !path ? "is-warning" : ""}`}>
        {blocked ? t('field.blockedHelp') : here ? gate ? t('field.destinationArrival') : t('field.currentHelp') : path ? gate ? t('field.destinationRoute',{count:path.length}) : t('field.walkRoute',{count:path.length}) : t('field.noRoute')}
      </p>}
      {!canStep && !debt && !here && <p class="field-unavailable" role="status">{t('field.insufficientFp')}</p>}
      {unavailable && <p class="field-unavailable" role="status">{unavailable}</p>}
      <details class="tile-description"><summary>{t('field.tileDetails')}</summary><small>{t('field.coordinates',{column:selected.column,row:selected.row,height:heightAt(selected,state.map)})}</small></details>
    </div>
    {!monsters.length && <div class="field-tile-actions">{!blocked && !here && <button disabled={disabled || !field || !path?.length || !canStep} onClick={walk}>{gate ? t('field.moveToGate') : t('field.moveHere')}{path ? t('field.moveCost',{count:path.length}) : ""}</button>}
      {gate && here && <button disabled={disabled || !field} onClick={() => command("/v1/maps/transitions", { connectionId: gate.id })}>{t('field.travelTo',{name:gate.targetName ?? gate.target})} ↗</button>}
    </div>}
  </section>;
}

export function FieldPanel({ state, selected, disabled, now, select, command }: Props) {
  const { t, locale } = useTranslation();
  state = {...state, map: localizedFieldMap(state.map, locale)};
  const monsters = state.monsters.filter(m => m.state !== "COOLDOWN").sort((a, b) => fieldDistance(state.me.position, a.position) - fieldDistance(state.me.position, b.position) || a.id.localeCompare(b.id));
  const renderMonster = (m: State["monsters"][number]) => <button key={m.id}
    class={`field-monster secondary ${selected && sameCell(selected, m.position) ? "is-selected" : ""}`}
    aria-pressed={!!selected && sameCell(selected, m.position)} onClick={() => select(m.position)}>
    <span><strong>{monsterName(localizedMonster(m, locale))}</strong><small>{m.disposition === "AGGRESSIVE" ? t('field.aggressive') : t('field.passive')} · {m.state === "AVAILABLE" ? t('field.available') : t('field.unavailable')}</small></span>
    <span>{t('field.gridDistance',{count:fieldDistance(state.me.position, m.position)})} <span aria-hidden="true">›</span></span>
  </button>;
  const reservation = state.reservation;
  return <section class="card field-panel">
    {reservation ? <div class="field-reservation" aria-label={t('field.preparation')}>
      <h3>{t('field.preparation')}</h3><p role="status">{t('field.readyProgress',{ready:reservation.ready.length,total:reservation.members.length,seconds:Math.max(0,Math.ceil(reservation.deadline-now))})}</p>
      <div class="actions"><button disabled={disabled || (state.me.fp !== undefined && state.me.fp < 0) || reservation.ready.includes(state.me.id)} onClick={() => command("/v1/game/encounters/ready", { reservationId: reservation.id })}>{reservation.ready.includes(state.me.id) ? t('field.waitingParty') : t('field.ready')}</button>
      <button class="secondary" disabled={disabled} onClick={() => command("/v1/game/encounters/cancel", { reservationId: reservation.id })}>{t('field.cancelReservation')}</button></div>
    </div> : <><h3>{t('field.nearby')}</h3><p class="field-subtitle">{t('field.nearbyHelp')}</p></>}
    {monsters.slice(0, NEARBY_LIMIT).map(renderMonster)}
    {monsters.length > NEARBY_LIMIT && <details class="field-details"><summary>{t('field.remainingMonsters',{count:monsters.length-NEARBY_LIMIT})}</summary>{monsters.slice(NEARBY_LIMIT).map(renderMonster)}</details>}
    {!monsters.length && <p class="field-subtitle">{t('field.noMonsters')}</p>}
    <details class="field-details"><summary>{t('field.connectedMaps',{count:state.map.connections.length})}</summary>
      {state.map.connections.map(g => <button class="field-monster secondary" key={g.id} onClick={() => select(g)}><span>{g.targetName ?? g.target}</span><small>{sameCell(g, state.me.position) ? t('field.currentPosition') : t('field.gridDistance',{count:fieldDistance(g,state.me.position)})} ↗</small></button>)}
      {!state.map.connections.length && <p>{t('field.noConnections')}</p>}
    </details>
  </section>;
}
