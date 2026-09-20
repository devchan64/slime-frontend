import {MapKindIcon} from './MapKindIcon';
import { fieldMovementEstimate } from "./terrainMovementCost";
import { findCityBuilding } from "../game/terrain/cityBuildings";
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

function formatCompactMovementEstimate(fieldMapDefinition: State["map"], selectedRouteCells: Position[]) {
  const { expected: expectedMovementCost, max: maximumMovementCost } = fieldMovementEstimate(fieldMapDefinition, selectedRouteCells);
  return t("field.terrainFpCompact", { expected: expectedMovementCost, max: maximumMovementCost });
}

export function FieldEventShortcuts({ state, selected, select, disabled }: Pick<Props, "state" | "selected" | "select" | "disabled">) {
  const { t, locale } = useTranslation();
  const map = localizedFieldMap(state.map, locale);
  const events = [
    ...state.monsters.filter(monster => monster.state === "AVAILABLE").map(monster => ({
      id: `monster:${monster.id}`, position: monster.position, name: monsterName(localizedMonster(monster, locale)),
      targetSafeTown: undefined as boolean | undefined, kind: "", nameClass: monster.disposition === "AGGRESSIVE" ? "monster-name is-aggressive" : "monster-name is-passive",
    })),
    ...map.connections.map(gate => ({
      id: `connection:${gate.id}`, position: gate, name: gate.targetName ?? gate.target, targetSafeTown: gate.targetSafeTown, kind: t(gate.targetSafeTown === undefined ? 'app.mapUnknownKind' : gate.targetSafeTown ? 'app.mapTown' : 'app.mapField'), nameClass: "",
    })),
  ].map(event => ({ ...event, distance: fieldDistance(state.me.position, event.position) }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, EVENT_SHORTCUT_LIMIT);
  return <nav class="field-event-shortcuts" aria-label={t('field.nearbyEvents')}>
    {events.map(event => <button key={event.id} class="secondary" disabled={disabled}
      aria-pressed={!!selected && sameCell(event.position, selected)}
      title={`${event.kind ? `${event.kind} · ` : ""}${event.name} · ${t('field.gridDistance',{count:event.distance})}`}
      aria-label={`${event.kind ? `${event.kind} · ` : ""}${event.name} · ${t('field.gridDistance',{count:event.distance})}`}
      onClick={() => select(event.position)}>
      {event.kind && <MapKindIcon targetMapSafeTown={event.targetSafeTown}/>}<strong class={event.nameClass}>{event.name}</strong><small>{t('field.shortcutDistance',{count:event.distance})}</small>
    </button>)}
    {!events.length && <p>{t('field.noEvents')}</p>}
  </nav>;
}

export function FieldSelection({ state, selected, disabled, select, command, walking, walk, stop, encounter, disabledReason }: Props & {
  walking: Walking | null; walk: (requestedWalkingDestination?: Position) => void; stop: () => void; encounter?: (monsterId: string) => void; disabledReason?: string;
}) {
  const { t, locale } = useTranslation();
  state = {...state, map: localizedFieldMap(state.map, locale)};
  const debt = state.me.fp !== undefined && state.me.fp < 0;
  const healthMovementLocked = state.me.healthRecoveryPending === true;
  const canStep = !healthMovementLocked && (state.map.safeTown || state.me.fp === undefined || state.me.fp >= 1);
  disabled = disabled || debt;
  if (debt) disabledReason = t('field.debtHelp');
  if (walking) return <section class="field-selection field-walking" aria-label={t('field.walkingProgress')}>
    <div class="field-selection-heading"><div><span class="field-kicker">{t('field.walking')}</span>
      <h3>{walking.stopping ? t('field.stopping') : t('field.walkingHeading')}</h3></div>
      <button class="secondary compact" disabled={walking.stopping} onClick={stop}>{walking.stopping ? t('field.stopRequested') : t('field.stop')}</button></div>
    <p role="status">{t('field.walked',{completed:walking.completed,total:walking.total})} · {walking.stopping ? t('field.stopAfterTile') : t('field.stopAnytime')}</p>
    <progress value={walking.completed} max={walking.total} aria-label={t('field.progressLabel')} />
  </section>;
  if (!selected) return null;
  const selectedCityBuilding = findCityBuilding(state.map.buildings,selected);
  const currentBuildingEntrance = selectedCityBuilding?.entrance;
  const currentEntranceRoute = currentBuildingEntrance ? fieldRoute(state.me.position,currentBuildingEntrance,state.map) : null;
  const atBuildingEntrance = currentBuildingEntrance ? sameCell(state.me.position,currentBuildingEntrance) : false;
  const blocked = state.map.blocked.some(p => sameCell(p, selected));
  const path = fieldRoute(state.me.position, selected, state.map);
  const here = sameCell(state.me.position, selected);
  const monsters = state.monsters.filter(m => m.state !== "COOLDOWN" && sameCell(m.position, selected));
  const gate = state.map.connections.find(g => sameCell(g, selected));
  const safe = state.map.safeTown || fieldDistance(state.map.startPoint, selected) <= state.map.safeRadius;
  const field = state.me.mode === "FIELD";
  const unavailable = !field ? t('field.finishPreparation') : disabled ? disabledReason ?? t('field.busy') : null;
  return <section class="field-selection" aria-label={t('field.selectedLocation')}>
    <div class="field-command-body">
      {monsters.map(m => {
        const distance = fieldDistance(state.me.position, m.position);
        const route = encounterRoute(state.me.position, m.position, state.map);
        return <div class="field-target" key={m.id}><div>
          <strong class={`monster-name ${m.disposition === "AGGRESSIVE" ? "is-aggressive" : "is-passive"}`}>{monsterName(localizedMonster(m, locale))}</strong>
          <small>{m.state !== "AVAILABLE" ? t('field.encounterBusy') : distance > 1 ? route ? state.map.movementCosts ? formatCompactMovementEstimate(state.map, route) : t('field.approachCost',{count:route.length}) : t('field.noApproach') : t('field.adjacentCompact')}</small></div>
          <button class="secondary compact" aria-label={t('field.clearSelection')} onClick={() => select(null)}>{t('field.clear')}</button>
          <button class="compact" disabled={disabled || state.me.hp === 0 || !field || m.state !== "AVAILABLE" || (distance > 1 && (!route || !encounter || !canStep))}
            onClick={() => distance > 1 ? encounter?.(m.id) : command("/v1/game/encounters/reserve", { monsterId: m.id })}>{distance > 1 ? t('field.approachEncounter') : t('field.startEncounter')}</button></div>;
      })}
      {selectedCityBuilding && <div class="field-target"><div class="field-target-summary">
        <strong>{t(`city.${selectedCityBuilding.facilityKind}`)}</strong>
        {!!selectedCityBuilding.npcs?.length && <small>{t('city.staff',{names:selectedCityBuilding.npcs.map(currentFacilityNpc=>currentFacilityNpc.name).join(', ')})}</small>}
        <small>{atBuildingEntrance?t('city.arrived'):t('city.safeTown')}</small></div>
        <button class="secondary compact" onClick={()=>select(null)}>{t('field.clear')}</button>
        <button disabled={disabled || !field || !canStep || atBuildingEntrance || !currentEntranceRoute?.length}
          onClick={()=>walk(selectedCityBuilding.entrance)}>{t('city.approach')}</button></div>}
      {!monsters.length && !selectedCityBuilding && <div class="field-target">
        <div class="field-target-summary">
          <strong>{blocked ? t('field.blockedTerrain') : gate ? t('field.destinationHeading', {name:gate.targetName ?? gate.target}) : here ? t('field.currentPosition') : safe ? t('field.safeArea') : t('field.explorationPoint')}</strong>
          {path?.length && state.map.movementCosts ? <small>{formatCompactMovementEstimate(state.map, path)}</small>
            : here && gate ? <small>{t('field.arrivalCompact')}</small>
            : !blocked && !here && !path ? <small class="is-warning">{t('field.noApproach')}</small> : null}
        </div>
        <button class="secondary compact" aria-label={t('field.clearSelection')} onClick={() => select(null)}>{t('field.clear')}</button>
        {!(gate && here) && <button disabled={disabled || blocked || here || !field || !path?.length || !canStep} onClick={()=>walk()}>{gate ? t('field.moveToGate') : t('field.moveHere')}{path && !state.map.safeTown ? state.map.movementCosts ? t('field.terrainFpButton',{count:path.length}) : t('field.moveCost',{count:path.length}) : ""}</button>}
        {gate && here && <button disabled={disabled || !field || healthMovementLocked} onClick={() => command("/v1/maps/transitions", { connectionId: gate.id })}>{t('field.travelTo',{name:gate.targetName ?? gate.target})} ↗</button>}
      </div>}
      {!canStep && !healthMovementLocked && !debt && !here && <p class="field-unavailable" role="status">{t('field.insufficientFp')}</p>}
      {healthMovementLocked && <p class="field-unavailable" role="status">{t("field.recoveryPending")}</p>}
      {monsters.length > 0 && state.me.hp === 0 && <p class="field-unavailable" role="status">{t('field.healthDepleted')}</p>}
      {unavailable && <p class="field-unavailable" role="status">{unavailable}</p>}
    </div>
  </section>;
}

export function FieldPanel({ state, selected, disabled, now, select, command }: Props) {
  const { t, locale } = useTranslation();
  state = {...state, map: localizedFieldMap(state.map, locale)};
  const monsters = state.monsters.filter(m => m.state !== "COOLDOWN").sort((a, b) => fieldDistance(state.me.position, a.position) - fieldDistance(state.me.position, b.position) || a.id.localeCompare(b.id));
  const renderMonster = (m: State["monsters"][number]) => <button key={m.id}
    class={`field-monster secondary ${selected && sameCell(selected, m.position) ? "is-selected" : ""}`}
    aria-pressed={!!selected && sameCell(selected, m.position)} onClick={() => select(m.position)}>
    <span><strong class={`monster-name ${m.disposition === "AGGRESSIVE" ? "is-aggressive" : "is-passive"}`}>{monsterName(localizedMonster(m, locale))}</strong><small>{m.state === "AVAILABLE" ? t('field.available') : t('field.unavailable')}</small></span>
    <span>{t('field.gridDistance',{count:fieldDistance(state.me.position, m.position)})} <span aria-hidden="true">›</span></span>
  </button>;
  const reservation = state.reservation;
  return <section class="card field-panel">
    {reservation ? <div class="field-reservation" aria-label={t('field.preparation')}>
      <h3>{t('field.preparation')}</h3><p role="status">{t('field.readyProgress',{ready:reservation.ready.length,total:reservation.members.length,seconds:Math.max(0,Math.ceil(reservation.deadline-now))})}</p>
      <div class="actions"><button disabled={disabled || state.me.hp === 0 || (state.me.fp !== undefined && state.me.fp < 0) || reservation.ready.includes(state.me.id)} onClick={() => command("/v1/game/encounters/ready", { reservationId: reservation.id })}>{reservation.ready.includes(state.me.id) ? t('field.waitingParty') : t('field.ready')}</button>
      <button class="secondary" disabled={disabled} onClick={() => command("/v1/game/encounters/cancel", { reservationId: reservation.id })}>{t('field.cancelReservation')}</button></div>
    </div> : !state.map.safeTown ? <><h3>{t('field.nearby')}</h3><p class="field-subtitle">{t('field.nearbyHelp')}</p></> : <p>{t('city.safeTown')}</p>}
    {state.map.buildings?.length ? <><h3>{t('city.facilities')}</h3>{state.map.buildings.map(currentCityBuilding=><button
      key={currentCityBuilding.id} class="field-monster secondary" onClick={()=>select(currentCityBuilding.origin)}>
      <span><strong>{t(`city.${currentCityBuilding.facilityKind}`)}</strong>
        {!!currentCityBuilding.npcs?.length && <small>{t('city.staff',{names:currentCityBuilding.npcs.map(currentFacilityNpc=>currentFacilityNpc.name).join(', ')})}</small>}</span></button>)}</>:null}
    {monsters.slice(0, NEARBY_LIMIT).map(renderMonster)}
    {monsters.length > NEARBY_LIMIT && <details class="field-details"><summary>{t('field.remainingMonsters',{count:monsters.length-NEARBY_LIMIT})}</summary>{monsters.slice(NEARBY_LIMIT).map(renderMonster)}</details>}
    {!monsters.length && !state.map.safeTown && <p class="field-subtitle">{t('field.noMonsters')}</p>}
    <details class="field-details"><summary>{t('field.connectedMaps',{count:state.map.connections.length})}</summary>
      {state.map.connections.map(g => <button class="field-monster secondary" key={g.id} onClick={() => select(g)}><span><MapKindIcon targetMapSafeTown={g.targetSafeTown}/>{g.targetName ?? g.target}</span><small>{sameCell(g, state.me.position) ? t('field.currentPosition') : t('field.gridDistance',{count:fieldDistance(g,state.me.position)})} ↗</small></button>)}
      {!state.map.connections.length && <p>{t('field.noConnections')}</p>}
    </details>
  </section>;
}

export function FieldLocationHelp({ state: currentFieldState, selected: selectedFieldPosition }: Pick<Props, "state" | "selected">) {
  const { t: translateFieldMessage, locale: currentDisplayLocale } = useTranslation();
  if (!selectedFieldPosition) return null;
  const currentLocalizedMap = localizedFieldMap(currentFieldState.map, currentDisplayLocale);
  const selectedCityBuilding = findCityBuilding(currentLocalizedMap.buildings, selectedFieldPosition);
  const selectedWalkingDestination = selectedCityBuilding?.entrance ?? selectedFieldPosition;
  const selectedWalkingRoute = fieldRoute(currentFieldState.me.position, selectedWalkingDestination, currentLocalizedMap);
  const selectedMapConnection = currentLocalizedMap.connections.find(currentMapConnection => sameCell(currentMapConnection, selectedFieldPosition));
  const selectedPositionBlocked = currentLocalizedMap.blocked.some(currentBlockedPosition => sameCell(currentBlockedPosition, selectedFieldPosition));
  const selectedPositionCurrent = sameCell(currentFieldState.me.position, selectedFieldPosition);
  return <div class="field-location-help">
    <p>{translateFieldMessage('field.compactCoordinates', {column: selectedFieldPosition.column, row: selectedFieldPosition.row, height: heightAt(selectedFieldPosition, currentLocalizedMap)})}</p>
    <p>{selectedCityBuilding ? translateFieldMessage(sameCell(currentFieldState.me.position, selectedCityBuilding.entrance) ? 'city.arrived' : 'city.approach') : selectedPositionBlocked ? translateFieldMessage('field.blockedHelp') : selectedPositionCurrent
      ? translateFieldMessage(selectedMapConnection ? 'field.destinationArrival' : 'field.currentHelp')
      : selectedWalkingRoute ? translateFieldMessage(selectedMapConnection ? 'field.destinationRoute' : 'field.walkRoute', {count: selectedWalkingRoute.length})
      : translateFieldMessage('field.noRoute')}</p>
  </div>;
}
