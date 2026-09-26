import { FieldIdleAction } from "../animation/fieldIdleAction";
import { calculateFieldIdleDuration } from "../animation/standingActors";
import type {Notice} from '../../client/notice';
import {selectedFieldRoute} from '../../ui/fieldNavigation';
import { screenFacing, type WorldFacing } from "../animation/facing";
import { pickActorPosition, type ActorPickRegion } from '../terrain/actorPicking';
import {BattleMotion} from '../terrain/battleMotion';
import {FieldMotion} from '../terrain/fieldMotion';
import {ActorWindowCache, type ActorEntry} from '../terrain/actorViewport';
import {fitActorZoom} from '../terrain/actorFraming';
import { TerrainWindowCache, terrainWindow } from '../terrain/viewport';
import { toView, fromView, nextRotation, rotateConnections, type MapRotation } from "../terrain/rotation";
import { elevationTileAt, type Surface } from "../terrain/elevation";
import { prepareTerrain, overlayCells, type TerrainPlan } from '../terrain/renderPlan';
import Phaser from "phaser";
import type { State, Position, Unit } from "../../client/types";
import { buildMeadowRoad, fieldTerrainAt, TILE_W, TILE_H } from "../terrain/meadow";
import { createTerrainAtlas, preloadTerrain, TERRAIN_ATLAS } from "../terrain/textures";
import { drawWaypoint, waypointMarkerScale } from "../terrain/waypoint";
import { drawPersonalMarker } from '../terrain/personalMarkers';
import { drawSafeTower, preloadSafeTower } from "../terrain/safeTower";
import { drawSafeBoundary } from "../terrain/safeBarrier";
import { drawBlockedTerrain } from "../terrain/scenery";
import { constrainBackdropCamera, createBackdrop, fitBackdrop, preloadBackdrop } from "../terrain/backdrop";
import { drawActor, drawRestRecoveryEffect, preloadActors, updateCharacterFacing, HUMAN_HEIGHT } from "../terrain/actors";
import type { Appearance } from "../../client/types";
import { calculateActorPlacement } from "../terrain/actorPlacement";
import { findCityBuilding, cityBuildingCells } from "../terrain/cityBuildings";
import { drawCityBuilding, drawCityPaving, preloadCityBuildingTextures, type CityBuildingRegion } from "../terrain/cityRendering";
import { actorSize } from "../terrain/sizes";
import { roadConnections, roadFrame, waterConnections } from "../terrain/roadTiles";
import { addCliffWallPatterns, drawCliffs, drawElevationTile } from "../terrain/terraces";
import {project, pickSurface, cellDepth, mapAnnotationDepth, TERRAIN_DEPTH} from "../terrain/elevation";
const FIELD_CHARACTER_VERTICAL_OFFSET = 3;
const ACTOR_GROUND_SELECTION = { widthRatio: 0.4, heightRatio: 0.3, lineWidth: 1, alpha: 0.65 };
const COLORS = {
  ground: 0x172e3b,
  alternate: 0x1b3540,
  safe: 0x234b48,
  blocked: 0x344455,
  edge: 0x35515d,
  player: 0x73ead1,
  other: 0x74b7f4,
  enemy: 0xff8d77,
  passive: 0xe6c789,
  selected: 0xffebac,
};
const TEXT = {
  fontFamily: "sans-serif",
  fontSize: "13px",
  color: "#eaf7fa",
  backgroundColor: "#10222dcc",
  padding: { x: 5, y: 3 },
};
const CENTER = 0.5,
  LABEL_OFFSET = 25,
  BATTLE_DISPLAY_SCALE = 1.2,
  PORTRAIT_BATTLE_FILL = 1.5,
  CAMERA_PADDING = 40,
  DRAG_THRESHOLD = 6,
  ZOOM_MIN = 0.4,
  ZOOM_MAX = 1.4,
  FIELD_ZOOM_MAX = 2.8,
  TURN_BADGE_OFFSET = 16,
  TURN_BADGE_RADIUS = 11,
  PATH_WIDTH = 3,
  PATH_NODE_RADIUS = 7,
  PATH_COLOR = 0x9eeeff,
  ARRIVAL_COLOR = 0xffbb66;
const DEFAULT_TILE_ZOOM = 1.3;
const SAFE_BARRIER_PULSE = { cycleMilliseconds: 2600, minimumOpacity: 0.72, opacityRange: 0.28 };
const BATTLE_FRAMING_ZOOM = DEFAULT_TILE_ZOOM / BATTLE_DISPLAY_SCALE;
const MOVE_OVERLAY = {
  fill: 0x168ee0, alpha: 0.5, pathFill: 0x62dcff, pathAlpha: 0.62,
  outline: 0x071e35, outlineWidth: 6, edge: 0x9ceaff, edgeWidth: 3,
  arrivalInset: 0.72, arrivalWidth: 2, targetWidth: 4, selectedWidth: 4,
};
const ACTOR_DEPTH = { labelOffset: 0.01 };
const ACTOR_PICK_ALPHA_MINIMUM = 1;
const REST_RECOVERY_EFFECT_CYCLE_MILLISECONDS = 1200;
const FIELD_CAMERA_FOLLOW_MINIMUM_DISTANCE = 0.01;
export class MainScene extends Phaser.Scene {
  private personalMarkerGraphics: {graphic: Phaser.GameObjects.Graphics; expiresAt: number}[] = [];
  private receivedStateTimestamp = 0;
  private state: State | null = null;
  private useDefaultTileScale = false;
  private fieldMotion = new FieldMotion();
  private battleMotion = new BattleMotion();
  private movingObjects: {key:string;object:Phaser.GameObjects.Image;x:number;y:number;depth:number}[] = [];
  private restRecoveryEffects: {graphics:Phaser.GameObjects.Graphics;x:number;y:number;height:number;depth:number}[] = [];
  private actorCache: ActorWindowCache<Phaser.GameObjects.GameObject[]> | null = null;
  private cityBuildingRegions: CityBuildingRegion[] = [];
  private actorEntries: ActorEntry<Phaser.GameObjects.GameObject[]>[] = [];
  private queueUnit(id:string,...args:Parameters<MainScene['unit']>) {
    this.actorEntries.push({id,...this.calculateActorPlacement(args[0], args[6]),create:()=>this.unit(...args)});
  }
  private syncFieldMotion() {
    const s=this.state!;
    this.battleMotion.sync(`${s.location.id}:${s.generation}:${s.epoch}:${this.rotation}`,s.battle,
      (battlePathPosition, battleUnitIdentifier) => {
        const movingBattleUnit = s.battle?.units.find(battleUnitRecord => battleUnitRecord.id === battleUnitIdentifier);
        return this.calculateActorPlacement(battlePathPosition, movingBattleUnit?.side === "enemy" ? movingBattleUnit : undefined);
      },performance.now());
    const actors=s.battle ? [] : [
      ...s.monsters.filter(m=>m.state!=="COOLDOWN").map(m=>({id:`monster:${m.id}`,cell:m.position, appearance:m})),
      ...s.members.filter(m=>m.mode!=="IN_BATTLE").map(m=>({id:`member:${m.id}`,cell:m.position, appearance:undefined})),
    ];
    this.fieldMotion.sync(`${s.location.id}:${s.generation}:${s.epoch}:${this.rotation}`,
      actors.map(a=>({...a,point:this.calculateActorPlacement(a.cell,a.appearance)})),performance.now());
  }
  private fieldIdleAction = new FieldIdleAction();
  private animateFieldActors() {
    const now=performance.now();
    for(const item of this.movingObjects){
      const offset=item.key.startsWith("battle:") ? this.battleMotion.offset(item.key.slice(7),now) : this.fieldMotion.offset(item.key,now);
      const characterRestingFacing = item.object.getData("characterRestingFacing");
      if (characterRestingFacing) {
        const currentMovementFacing = item.key.startsWith("battle:") ? this.battleMotion.currentWorldFacing(item.key.slice(7), now) : undefined;
        const selectedScreenFacing = currentMovementFacing ? screenFacing(currentMovementFacing, this.rotation) : characterRestingFacing;
        let idleActionElapsedTime: number | null = null;
        if (item.key === `member:${this.state?.me.id}`) {
          const idleActionAllowedFlag = this.state?.location.kind === "FIELD" && !this.state.battle && !document.hidden &&
            item.object.getData("actorStandingKind") === "human" && offset.x === 0 && offset.y === 0;
          idleActionElapsedTime = this.fieldIdleAction.sampleIdleAction(now, calculateFieldIdleDuration(selectedScreenFacing), idleActionAllowedFlag);
          item.object.setData("fieldIdleAction", idleActionElapsedTime === null ? "standing" : "stretch-placeholder");
        }
        updateCharacterFacing(item.object, selectedScreenFacing, idleActionElapsedTime ?? undefined);
      }
      item.object.setPosition(item.x+offset.x,item.y+offset.y);
      item.object.setDepth(item.depth+(item.depth<this.annotationDepth() ? offset.depth : 0));
    }
  }
  private selected: Position | null = null;
  private rotation: MapRotation = 0;
  private viewSurface: Surface | null = null;
  private terrainPlan: TerrainPlan | null = null;
  private panStart: {x:number;y:number;scrollX:number;scrollY:number} | null = null;
  private battleMode: "MOVE" | "ATTACK" | null = null;
  private onSelect: (p: Position) => void;
  private previousMap = "";
  private preparedLocation = "";
  private onReady: (location: string) => void;
  private loadFailed = false;
  private onFailure: (failureNoticeValue: Notice) => void;
  private reachable = new Set<string>();
  private terrainObjects = new Set<Phaser.GameObjects.GameObject>();
  private backdropLayer: Phaser.GameObjects.Image | null = null;
  private terrainSignature = "";
  private terrainCache: TerrainWindowCache<Phaser.GameObjects.GameObject[]> | null = null;
  private waypointMarkers: Phaser.GameObjects.Container[] = [];
  private safeBarrierGraphics: Phaser.GameObjects.Graphics[] = [];
  private reducedMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private waypointZoom = 0;
  constructor(onSelect: (p: Position) => void, onReady: (location: string) => void, onFailure: (failureNoticeValue: Notice) => void) {
    super("world");
    this.onSelect = onSelect;
    this.onReady = onReady;
    this.onFailure = onFailure;
  }
  preload() {
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      this.loadFailed = true;
      this.onFailure({key:"app.mapAssetsFailed"});
    });
    preloadTerrain(this);
    preloadCityBuildingTextures(this);
    preloadActors(this);
    preloadSafeTower(this);
    preloadBackdrop(this);
  }
  create() {
    if (this.loadFailed) return;
    this.fieldIdleAction.resetIdleAction(performance.now());
    const resetFieldIdleAction = () => this.fieldIdleAction.resetIdleAction(performance.now());
    const recordFieldPointerDrag = (pointerEventValue: PointerEvent) => { if (pointerEventValue.buttons) resetFieldIdleAction(); };
    const idleActivityEventNames = ['pointerdown', 'pointerup', 'keydown', 'keyup', 'wheel', 'visibilitychange'] as const;
    for (const activityEventName of idleActivityEventNames) document.addEventListener(activityEventName, resetFieldIdleAction, {capture:true, passive:true});
    document.addEventListener('pointermove', recordFieldPointerDrag, {capture:true, passive:true});
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const activityEventName of idleActivityEventNames) document.removeEventListener(activityEventName, resetFieldIdleAction, true);
      document.removeEventListener('pointermove', recordFieldPointerDrag, true);
    });
    // 화면 회전 후 새 캔버스 크기를 기준으로 전장을 다시 맞춘다.
    const resize = () => this.game.events.once(Phaser.Core.Events.POST_STEP, this.focus, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.actorCache?.clear();
      this.actorCache=null;
      this.actorEntries=[];
      this.fieldMotion.clear();
      this.battleMotion.clear();
      this.movingObjects=[];
      this.restRecoveryEffects=[];
      this.terrainCache?.clear();
      this.terrainCache=null;
      this.scale.off(Phaser.Scale.Events.RESIZE, resize);
      this.game.events.off(Phaser.Core.Events.POST_STEP, this.focus, this);
    });
    try { createTerrainAtlas(this); }
    catch {
      this.loadFailed = true;
      this.onFailure({key:"app.mapSceneFailed"});
      return;
    }
    this.cameras.main.setZoom(DEFAULT_TILE_ZOOM);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.panStart={x:p.x,y:p.y,scrollX:this.cameras.main.scrollX,scrollY:this.cameras.main.scrollY};
      this.game.canvas.closest<HTMLElement>(".canvas-wrap")?.focus({preventScroll:true});
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.panStart) return;
      const dx=p.x-this.panStart.x,dy=p.y-this.panStart.y;
      if (Math.hypot(dx,dy)<DRAG_THRESHOLD) return;
      this.cameras.main.setScroll(this.panStart.scrollX-dx/this.cameras.main.zoom,
        this.panStart.scrollY-dy/this.cameras.main.zoom);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const start=this.panStart;this.panStart=null;
      if (!start || Math.hypot(p.x-start.x,p.y-start.y)>=DRAG_THRESHOLD) return;
      this.game.canvas.closest<HTMLElement>(".canvas-wrap")?.focus({ preventScroll: true });
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      if (!this.state) return;
      const picked = pickSurface(at.x, at.y, this.viewSurface!, this.terrainPlan!.heights);
      const visibleActorRegions: ActorPickRegion[] = [];
      for (const renderedSceneChild of this.children.list) {
        if (!(renderedSceneChild instanceof Phaser.GameObjects.Image) || !renderedSceneChild.visible) continue;
        const renderedActorPosition = renderedSceneChild.getData('actorSelectionPosition') as Position | undefined;
        if (!renderedActorPosition) continue;
        const renderedImageBounds = renderedSceneChild.getBounds();
        if (!renderedImageBounds.contains(at.x, at.y)) continue;
        const actorLocalPoint = renderedSceneChild.getWorldTransformMatrix().applyInverse(at.x, at.y);
        const actorPixelColumn = Math.floor(actorLocalPoint.x + renderedSceneChild.displayOriginX);
        const actorPixelRow = Math.floor(actorLocalPoint.y + renderedSceneChild.displayOriginY);
        const actorTextureAlpha = this.textures.getPixelAlpha(
          renderedSceneChild.flipX ? renderedSceneChild.width - 1 - actorPixelColumn : actorPixelColumn,
          renderedSceneChild.flipY ? renderedSceneChild.height - 1 - actorPixelRow : actorPixelRow,
          renderedSceneChild.texture.key, renderedSceneChild.frame.name);
        if (actorTextureAlpha === null || actorTextureAlpha < ACTOR_PICK_ALPHA_MINIMUM) continue;
        visibleActorRegions.push({position: renderedActorPosition, depth: renderedSceneChild.depth,
          left: renderedImageBounds.left, right: renderedImageBounds.right,
          top: renderedImageBounds.top, bottom: renderedImageBounds.bottom});
      }
      for(const currentBuildingRegion of this.cityBuildingRegions) {
        if(currentBuildingRegion.polygons.some(currentFacePolygon=>Phaser.Geom.Polygon.Contains(currentFacePolygon,at.x,at.y)))
          visibleActorRegions.push(currentBuildingRegion);
      }
      const cell = pickActorPosition(at, visibleActorRegions, this.selected)
        ?? (picked ? fromView(picked, this.surface(), this.rotation) : null);
      if (cell) {
        this.selected = cell;
        this.draw();
        this.onSelect(cell);
      }
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _x: number, dy: number) =>
      this.cameras.main.setZoom(
        Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, ZOOM_MIN, this.state?.battle ? ZOOM_MAX : FIELD_ZOOM_MAX),
      ),
    );
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (!(e.target as HTMLElement)?.closest(".canvas-wrap") ||
          (e.target as HTMLElement)?.closest("dialog[open]")) return;
      const delta: Record<string, number[]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (!delta[e.key] || !this.state) return;
      e.preventDefault();
      const base = this.selected || this.state.battle?.units.find(u => u.id === this.state?.me.id)?.position || this.state.me.position;
      const [dc, dr] = delta[e.key];
      const columns = this.state.battle?.field.columns ?? this.state.map.columns;
      const rows = this.state.battle?.field.rows ?? this.state.map.rows;
      const viewBase = this.viewPosition(base);
      const cell = fromView({ column: viewBase.column + dc, row: viewBase.row + dr }, this.surface(), this.rotation);
      if (
        cell.column >= 0 &&
        cell.row >= 0 &&
        cell.column < columns &&
        cell.row < rows
      ) {
        this.selected = cell;
        this.draw();
        this.onSelect(cell);
      }
    });
    this.draw();
  }
  adjustZoom(delta: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom+delta,ZOOM_MIN,this.state?.battle ? ZOOM_MAX : FIELD_ZOOM_MAX));
  }
  rotateMap(direction: -1 | 1) {
    if (!this.state || !this.sys.isActive()) return;
    this.rotation = nextRotation(this.rotation, direction);
    this.terrainPlan = prepareTerrain(this.state!, this.rotation, this.terrainPlan);
    this.viewSurface = this.terrainPlan.surface;
    this.panStart = null;
    this.syncFieldMotion();
    this.draw();
    // 회전 중 선택 좌표와 확대 배율을 유지한다.
    const anchor = this.selected ?? (this.state.battle
      ? { column: (this.surface().columns - 1) / 2, row: (this.surface().rows - 1) / 2 }
      : this.state.me.position);
    const point = this.project(anchor);
    this.cameras.main.centerOn(point.x, point.y);
  }
  setBattleMode(mode: "MOVE" | "ATTACK" | null) {
    this.battleMode = mode;
    if (this.sys.isActive()) this.draw();
  }
  selectCell(position: Position | null, focus = false) {
    this.selected = position;
    if (this.sys.isActive()) {
      this.draw();
      if (focus && position) {
        const point = this.project(position);
        this.cameras.main.centerOn(point.x, point.y);
      }
    }
  }
  setState(s: State) {
    if (!this.state || this.state.location.id !== s.location.id || this.state.generation !== s.generation || this.state.epoch !== s.epoch ||
        Boolean(this.state.battle) !== Boolean(s.battle) || this.state.me.position.column !== s.me.position.column || this.state.me.position.row !== s.me.position.row)
      this.fieldIdleAction.resetIdleAction(performance.now());
    this.state = s;
    this.receivedStateTimestamp = performance.now();
    this.terrainPlan = prepareTerrain(this.state!, this.rotation, this.terrainPlan);
    this.viewSurface = this.terrainPlan.surface;
    this.syncFieldMotion();
    if (this.sys.isActive()) this.draw();
  }
  update() {
    const currentEstimatedServerTime = (this.state?.serverTime ?? 0) + (performance.now()-this.receivedStateTimestamp)/1000;
    this.personalMarkerGraphics = this.personalMarkerGraphics.filter(currentMarkerGraphic => {
      if (currentEstimatedServerTime < currentMarkerGraphic.expiresAt) return true;
      currentMarkerGraphic.graphic.destroy();
      return false;
    });
    const safeBarrierOpacity = this.reducedMotionPreference.matches ? 1 : SAFE_BARRIER_PULSE.minimumOpacity
      + SAFE_BARRIER_PULSE.opacityRange * (1 + Math.sin(this.time.now * Math.PI * 2 / SAFE_BARRIER_PULSE.cycleMilliseconds)) / 2;
    for (const safeBarrierGraphic of this.safeBarrierGraphics) safeBarrierGraphic.setAlpha(safeBarrierOpacity);
    if (this.backdropLayer?.visible) constrainBackdropCamera(this.backdropLayer, this.cameras.main);
    this.syncTerrainViewport();
    this.syncActorViewport();
    this.animateFieldActors();
    this.followMovingFieldCharacter();
    this.animateRestRecoveryEffects();
    const zoom = this.cameras.main.zoom;
    if (zoom === this.waypointZoom) return;
    for (const marker of this.waypointMarkers) marker.setScale(waypointMarkerScale(zoom));
    this.waypointZoom = zoom;
  }
  resetCameraView() {
    this.useDefaultTileScale = true;
    this.focus();
  }
  focus() {
    if (this.state) {
      const battle = this.state.battle;
      const extent = battle ? battle.field.columns + battle.field.rows : 0;
      const widthFit = this.cameras.main.width / (extent * TILE_W / 2 + CAMERA_PADDING);
      const heightFit = this.cameras.main.height / (extent * TILE_H / 2 + CAMERA_PADDING);
      this.cameras.main.setZoom(battle ? Math.min(BATTLE_FRAMING_ZOOM,
        this.cameras.main.width < this.cameras.main.height ? Math.min(heightFit, widthFit * PORTRAIT_BATTLE_FILL) : Math.min(widthFit, heightFit)) : DEFAULT_TILE_ZOOM);
      if (battle && this.backdropLayer) {
        const cover = Math.max(this.cameras.main.width / this.backdropLayer.displayWidth,
          this.cameras.main.height / this.backdropLayer.displayHeight);
        this.cameras.main.setZoom(Math.min(BATTLE_FRAMING_ZOOM, Math.max(this.cameras.main.zoom, cover)));
      }
      if (battle) this.cameras.main.setZoom(Math.min(DEFAULT_TILE_ZOOM, this.cameras.main.zoom * BATTLE_DISPLAY_SCALE));
      const point = this.project(
        this.state.battle ? { column: (this.state.battle.field.columns - 1) / 2, row: (this.state.battle.field.rows - 1) / 2 } : this.state.me.position,
      );
      if(battle) {
        const bounds=battle.units.filter(unit=>unit.hp>0).map(unit=>{
          const p=this.calculateActorPlacement(unit.position,unit.side==='ally'?undefined:unit),size=actorSize(unit.side==='ally'?undefined:unit);
          return {left:p.x-TILE_W*size.tiles/2,right:p.x+TILE_W*size.tiles/2,
            top:p.y-HUMAN_HEIGHT*size.scale-TURN_BADGE_OFFSET-TURN_BADGE_RADIUS,
            bottom:p.y+TILE_H*size.tiles/2};
        });
        this.cameras.main.setZoom(fitActorZoom(this.cameras.main.zoom,point,this.cameras.main,bounds));
      }
      if (this.useDefaultTileScale) this.cameras.main.setZoom(DEFAULT_TILE_ZOOM);
      this.cameras.main.centerOn(point.x, point.y);
      this.syncActorViewport();
      this.animateFieldActors();
    }
  }
  private draw() {
    const s = this.state;
    if (!s || this.loadFailed) return;
    this.actorCache?.clear();
    this.actorCache=null;
    this.actorEntries=[];
    this.movingObjects=[];
    this.restRecoveryEffects=[];
    for (const child of [...this.children.list])
      if (!this.terrainObjects.has(child) && child !== this.backdropLayer) child.destroy();
    this.cityBuildingRegions = [];
    this.waypointMarkers = [];
    this.personalMarkerGraphics = [];
    this.safeBarrierGraphics = [];
    const meadow = !s.battle;
    const textured = meadow || !!s.battle?.field.cells;
    this.updateTerrain(s, textured);
    const blocked = s.battle?.blocked || s.map.blocked;
    this.reachable.clear();
    for (const move of this.battleMode === "MOVE" ? s.battle?.tactics.moves || [] : [])
      this.reachable.add(`${move.position.column},${move.position.row}`);
    const selectedMove = this.battleMode === "MOVE" ? s.battle?.tactics.moves.find(m => this.selected?.column === m.position.column && this.selected.row === m.position.row) : undefined;
    const previewPath = new Set((selectedMove?.path || []).map(p => `${p.column},${p.row}`));
    const arrivalRange = new Set((selectedMove?.attackRange || []).map(p => `${p.column},${p.row}`));
    const arrivalTargets = new Set((selectedMove?.attacks || []).map(a => {
      const target = s.battle!.units.find(u => u.id === a.targetId)!;
      return `${target.position.column},${target.position.row}`;
    }));
    const attackCells = new Set((this.battleMode === "ATTACK" ? s.battle?.tactics.attacks || [] : []).map(a => {
      const target = s.battle!.units.find(u => u.id === a.targetId)!;
      return `${target.position.column},${target.position.row}`;
    }));
    const blockedKeys = new Set(blocked.map(p=>`${p.column},${p.row}`));
    for (const {column,row} of overlayCells(s,textured,this.selected,
      [this.reachable,previewPath,arrivalRange,attackCells])) {
        const point = this.project({ column, row });
        const g = this.add.graphics().setDepth(this.depth({column,row}) + TERRAIN_DEPTH.overlay);
        const wall = blockedKeys.has(`${column},${row}`);
        const isSafe =
          !s.battle &&
          Math.abs(column - s.map.startPoint.column) +
            Math.abs(row - s.map.startPoint.row) <=
            s.map.safeRadius;
        const cellKey = `${column},${row}`;
        const reachable = !wall && this.reachable.has(cellKey);
        const onPath = previewPath.has(cellKey);
        const color = wall ? COLORS.blocked : isSafe
              ? COLORS.safe
              : (row + column) % 2
                ? COLORS.ground
                : COLORS.alternate;
        const polygon = [
          point.x,
          point.y - TILE_H / 2,
          point.x + TILE_W / 2,
          point.y,
          point.x,
          point.y + TILE_H / 2,
          point.x - TILE_W / 2,
          point.y,
        ];
        if (!meadow || isSafe) {
          g.fillStyle(color, textured ? (meadow ? 0.16 : 0) : 1);
          g.fillPoints(this.points(polygon), true);
        }
        if (isSafe && !s.map.safeTown) {
          drawSafeBoundary(g, point, this.viewPosition({column, row}), this.viewPosition(s.map.startPoint), s.map.safeRadius);
          this.safeBarrierGraphics.push(g);
        }
        if (!meadow && !textured) {
          g.lineStyle(1, COLORS.edge, 0.5);
          g.strokePoints(this.points(polygon), true);
        }
        // 지형 명암과 구별되는 이중선으로 서버가 허용한 이동 칸만 표시한다.
        if (reachable) {
          g.fillStyle(onPath ? MOVE_OVERLAY.pathFill : MOVE_OVERLAY.fill,
            onPath ? MOVE_OVERLAY.pathAlpha : MOVE_OVERLAY.alpha);
          g.fillPoints(this.points(polygon), true);
          g.lineStyle(MOVE_OVERLAY.outlineWidth, MOVE_OVERLAY.outline, 0.95);
          g.strokePoints(this.points(polygon), true);
          g.lineStyle(MOVE_OVERLAY.edgeWidth, MOVE_OVERLAY.edge, 1);
          g.strokePoints(this.points(polygon), true);
        }
        if (arrivalRange.has(cellKey)) {
          const inset = this.points(polygon).map(p => new Phaser.Geom.Point(
            point.x + (p.x - point.x) * MOVE_OVERLAY.arrivalInset,
            point.y + (p.y - point.y) * MOVE_OVERLAY.arrivalInset));
          if (!reachable) {
            g.fillStyle(ARRIVAL_COLOR, 0.18);
            g.fillPoints(inset, true);
          }
          g.lineStyle(arrivalTargets.has(cellKey) ? MOVE_OVERLAY.targetWidth : MOVE_OVERLAY.arrivalWidth, ARRIVAL_COLOR);
          g.strokePoints(inset, true);
        }
        if (!selectedMove && attackCells.has(`${column},${row}`)) {
          g.lineStyle(3, COLORS.enemy);
          g.strokePoints(this.points(polygon), true);
        }
        if (this.selected?.column === column && this.selected.row === row) {
          g.setDepth(this.annotationDepth());
          g.lineStyle(s.battle ? MOVE_OVERLAY.selectedWidth : 2, COLORS.selected);
          g.strokePoints(this.points(polygon), true);
        }
      }
    const selectedFieldPath = selectedFieldRoute(s,this.selected);
    const currentPreviewPath = selectedMove?.path ?? selectedFieldPath;
    if (currentPreviewPath?.length) {
      const g = this.add.graphics().setDepth(this.annotationDepth());
      const currentRouteOrigin = s.battle ? s.battle.units.find(currentBattleUnit => currentBattleUnit.id === s.me.id)!.position : s.me.position;
      const points = [currentRouteOrigin, ...currentPreviewPath].map(p => this.project(p));
      g.setData('fieldRoutePreview', s.battle ? null : currentPreviewPath);
      g.lineStyle(PATH_WIDTH, PATH_COLOR, 1);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
      for (const [index, point] of points.slice(1).entries()) {
        if (!s.battle && index !== currentPreviewPath.length - 1) continue;
        g.fillStyle(PATH_COLOR);
        g.fillCircle(point.x, point.y, PATH_NODE_RADIUS);
        if (s.battle) this.add.text(point.x, point.y, String(index + 1), {
          fontFamily: "sans-serif", fontSize: "10px", fontStyle: "bold", color: "#10202a",
        }).setOrigin(CENTER).setDepth(this.annotationDepth());
      }
    }
    if (s.battle) {
      for (const unit of [...s.battle.units].sort(
        (a, b) =>
          a.position.row +
          a.position.column -
          b.position.row -
          b.position.column,
      ))
        if (unit.hp > 0)
          this.queueUnit(unit.id,
            unit.position,
            unit.side === "enemy"
              ? COLORS.enemy
              : unit.id === s.me.id
                ? COLORS.player
                : COLORS.other,
            unit.name,
            unit.id === s.battle.order[s.battle.index],
            s.battle.order.indexOf(unit.id) + 1,
            s.battle.order.indexOf(unit.id) < s.battle.index,
            unit.side === "ally" ? undefined : unit,
            unit, `battle:${unit.id}`, unit.facing,
          );
    } else {
      const currentEstimatedServerTime = s.serverTime + (performance.now()-this.receivedStateTimestamp)/1000;
      for (const currentMarkerRecord of s.me.personalMarkers ?? []) {
        if (currentMarkerRecord.mapId !== s.map.id || currentMarkerRecord.expiresAt <= currentEstimatedServerTime) continue;
        const currentMarkerGraphic = drawPersonalMarker(this,currentMarkerRecord,this.project(currentMarkerRecord.position))
          .setDepth(this.depth(currentMarkerRecord.position)+TERRAIN_DEPTH.overlay);
        this.personalMarkerGraphics.push({graphic:currentMarkerGraphic,expiresAt:currentMarkerRecord.expiresAt});
      }
      for (const gate of s.map.connections) {
        const p = this.project(gate);
        this.waypointMarkers.push(drawWaypoint(this, gate, p.x, p.y).setDepth(this.annotationDepth()));
      }
      if(!s.map.safeTown)drawSafeTower(this, this.project(s.map.startPoint)).setDepth(this.depth(s.map.startPoint) + TERRAIN_DEPTH.overlay);
      const selectedCityBuilding = findCityBuilding(s.map.buildings,this.selected);
      for(const currentCityBuilding of s.map.buildings ?? [])
        this.cityBuildingRegions.push(drawCityBuilding(this,currentCityBuilding,this.project,this.depth,this.annotationDepth(),currentCityBuilding.id===selectedCityBuilding?.id));
      for (const m of s.monsters.filter(monster => monster.state !== "COOLDOWN"))
        this.queueUnit(`monster:${m.id}`,
          m.position,
          m.disposition === "AGGRESSIVE" ? COLORS.enemy : COLORS.passive,
          m.name || "슬라임",
          false, undefined, false, m, undefined, `monster:${m.id}`, m.facing,
        );
      for (const member of s.members)
        if (member.mode !== "IN_BATTLE")
          this.queueUnit(`member:${member.id}`,
            member.position,
            member.id === s.me.id ? COLORS.player : COLORS.other,
            member.name,
            member.id === s.me.id, undefined, false, undefined, undefined, `member:${member.id}`, member.facing ?? (member.id === s.me.id ? s.me.fieldFacing : undefined),
            member.mode === "FIELD" && (member.id === s.me.id ? !!s.me.fieldRest?.active : !!member.fieldRestActive),
          );
    }
    this.rebuildActorViewport();
    this.animateFieldActors();
    const location = s.location.id;
    if (this.preparedLocation !== location) {
      this.preparedLocation = location;
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        if (this.state?.location.id === location) this.onReady(location);
      });
    }
    const mapKey = s.battle?.id || s.map.id;
    if (this.previousMap !== mapKey) {
      this.previousMap = mapKey;
      this.useDefaultTileScale = false;
      this.focus();
    }
  }
  private surface = () => this.state!.battle?.field ?? this.state!.map;
  private viewPosition = (p: Position) => toView(p, this.surface(), this.rotation);
  private project = (p: Position) => project(this.viewPosition(p), this.viewSurface!);
  private depth = (p: Position) => cellDepth(this.viewPosition(p));
  private calculateActorPlacement = (actorLogicalPosition: Position, actorAppearanceData?: Appearance) =>
    calculateActorPlacement(actorLogicalPosition, actorSize(actorAppearanceData).tiles, this.surface(), this.project, this.depth);
  private annotationDepth = () => mapAnnotationDepth(this.viewSurface!);

  private animateRestRecoveryEffects() {
    const currentProgress = this.reducedMotionPreference.matches ? 0 :
      (this.time.now % REST_RECOVERY_EFFECT_CYCLE_MILLISECONDS) / REST_RECOVERY_EFFECT_CYCLE_MILLISECONDS;
    for (const currentEffect of this.restRecoveryEffects) {
      drawRestRecoveryEffect(currentEffect.graphics,currentEffect.x,currentEffect.y,currentEffect.height,currentProgress);
      currentEffect.graphics.setAlpha(1).setDepth(currentEffect.depth);
    }
  }

  /** 필드에서 자기 캐릭터의 보간 이동 구간에만 카메라를 함께 이동한다. */
  private followMovingFieldCharacter() {
    const currentGameState = this.state;
    if (!currentGameState || !currentGameState.me || currentGameState.battle || this.panStart) return;
    const currentMotionOffset = this.fieldMotion.offset(`member:${currentGameState.me.id}`, performance.now());
    if (Math.hypot(currentMotionOffset.x, currentMotionOffset.y) < FIELD_CAMERA_FOLLOW_MINIMUM_DISTANCE) return;
    const currentCharacterPoint = this.calculateActorPlacement(currentGameState.me.position);
    this.cameras.main.centerOn(
      currentCharacterPoint.x + currentMotionOffset.x,
      currentCharacterPoint.y + currentMotionOffset.y,
    );
  }

  private updateTerrain(s: State, visible: boolean) {
    for (const object of this.terrainObjects) (object as Phaser.GameObjects.Image).setVisible(visible);
    this.backdropLayer?.setVisible(visible);
    if (!visible) { this.cameras.main.removeBounds(); return; }
    const field = s.battle?.field, definition = field ?? s.map;
    const theme = field?.environment?.themeId ?? s.map.id;
    const blocked = s.battle?.blocked ?? s.map.blocked;
    if (!this.backdropLayer) this.backdropLayer = createBackdrop(this);
    fitBackdrop(this.backdropLayer, this.cameras.main,
      this.project({column:(definition.columns-1)/2,row:(definition.rows-1)/2}),
      (definition.columns+definition.rows)*TILE_W/2,(definition.columns+definition.rows)*TILE_H/2,theme);
    this.backdropLayer.setAlpha(.5);
    const signature=`${this.rotation}:${this.terrainPlan!.signature}`;
    if(signature===this.terrainSignature && this.terrainCache) { this.syncTerrainViewport(); return; }
    this.terrainCache?.clear();
    for(const object of this.terrainObjects)object.destroy();
    this.terrainObjects.clear();
    const cells = new Map(field?.cells?.map(cell => [`${cell.column},${cell.row}`, cell.terrain]));
    const road=field ? new Set([...cells].filter(([,kind])=>kind==='road').map(([key])=>key)) : buildMeadowRoad(s.map);
    const blockedCells=new Set(blocked.map(p=>`${p.column},${p.row}`));
    const cityBuildingCellKeys = new Set((field?[]:s.map.buildings ?? []).flatMap(cityBuildingCells).map(currentCityCell=>`${currentCityCell.column},${currentCityCell.row}`));
    const waterCells = field ? new Set([...cells].filter(([, kind]) => kind === "water").map(([key]) => key))
      : s.map.safeTown ? new Set((s.map.terrainRows ?? []).flatMap((currentTerrainRow,currentRowIndex)=>[...currentTerrainRow].flatMap((currentTerrainCode,currentColumnIndex)=>s.map.terrainCodes?.[currentTerrainCode]==='water'?[`${currentColumnIndex},${currentRowIndex}`]:[])))
      : new Set([...(theme === "mist-lake" ? blockedCells : []), ...(s.map.terrainRows ?? []).flatMap((currentTerrainRow,currentRowIndex)=>[...currentTerrainRow].flatMap((currentTerrainCode,currentColumnIndex)=>s.map.terrainCodes?.[currentTerrainCode]==='water'?[`${currentColumnIndex},${currentRowIndex}`]:[]))]);
    const towerCenterCellKey = field || s.map.safeTown ? null : `${s.map.startPoint.column},${s.map.startPoint.row}`;
    if (towerCenterCellKey) waterCells.delete(towerCenterCellKey);
    this.terrainCache=new TerrainWindowCache((viewColumn,viewRow)=>{
      const objects:Phaser.GameObjects.GameObject[]=[];
      const remember = <T extends Phaser.GameObjects.GameObject>(object:T):T => {
        objects.push(object);this.terrainObjects.add(object);return object;
      };
      const cell=fromView({column:viewColumn,row:viewRow},definition,this.rotation);
      const {column,row}=cell,p=this.project(cell),depth=this.depth(cell);
      if(field){
        const grid=remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.overlay));
        grid.lineStyle(1,COLORS.edge,.5);
        grid.strokePoints(this.points([p.x,p.y-TILE_H/2,p.x+TILE_W/2,p.y,p.x,p.y+TILE_H/2,p.x-TILE_W/2,p.y]),true);
      }
      const terrain=field ? cells.get(`${column},${row}`) : fieldTerrainAt(s.map,column,row,road);
      if(!terrain)throw new Error(`전장 지형이 없습니다: ${column},${row}`);
      const kind=terrain==='rock'||terrain==='thicket'?'grass':terrain;
      const elevationTile=elevationTileAt(this.viewPosition(cell),this.viewSurface!);
      if(elevationTile){
        drawElevationTile(remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.surface)),elevationTile,this.viewSurface!);
        return objects;
      }
      const sides=remember(this.add.graphics().setDepth(depth));
      drawCliffs(sides,this.viewPosition(cell),this.viewSurface!);
      addCliffWallPatterns(this,remember,this.viewPosition(cell),this.viewSurface!,depth);
      const isWater = waterCells.has(`${column},${row}`);
      const frame = isWater ? `water-${rotateConnections(waterConnections(cell, definition, waterCells), this.rotation)}`
        : kind === 'road' ? roadFrame(rotateConnections(roadConnections(cell, definition, road), this.rotation)) : kind;
      remember(this.add.image(p.x,p.y,TERRAIN_ATLAS,frame)
        .setDisplaySize(TILE_W,TILE_H).setDepth(depth+TERRAIN_DEPTH.surface));
      if(terrain==='paving'&&!field&&s.map.safeTown)drawCityPaving(remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.surface+1)),p);
      if (!isWater && !['boulder','tree-base'].includes(terrain) && !cityBuildingCellKeys.has(`${column},${row}`) && blockedCells.has(`${column},${row}`) && `${column},${row}` !== towerCenterCellKey) {
        const detail=remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.surface+1));
        const obstacleKind=terrain==='water'||terrain==='rock'||terrain==='thicket'?terrain:undefined;
        drawBlockedTerrain(detail,cell,p.x,p.y,theme,obstacleKind);
      }
      return objects;
    }, objects=>{for(const object of objects){this.terrainObjects.delete(object);object.destroy();}});
    this.terrainSignature=signature;
    this.syncTerrainViewport();
  }

  private syncTerrainViewport() {
    if(!this.terrainCache || !this.terrainPlan || !this.backdropLayer?.visible)return;
    const camera=this.cameras.main;
    const width=camera.width/camera.zoom,height=camera.height/camera.zoom;
    const left=camera.scrollX+(camera.width-width)/2,top=camera.scrollY+(camera.height-height)/2;
    this.terrainCache.sync(terrainWindow(this.terrainPlan.surface,this.terrainPlan.heights,
      {left,top,right:left+width,bottom:top+height}));
  }

  private points(values: number[]) {
    const result = [];
    for (let i = 0; i < values.length; i += 2)
      result.push(new Phaser.Geom.Point(values[i], values[i + 1]));
    return result;
  }
  private rebuildActorViewport() {
    this.actorCache=new ActorWindowCache(this.actorEntries,objects=>{
      const removed=new Set(objects);
      this.movingObjects=this.movingObjects.filter(item=>!removed.has(item.object));
      this.restRecoveryEffects=this.restRecoveryEffects.filter(currentEffect=>!removed.has(currentEffect.graphics));
      for(const object of objects)object.destroy();
    });
    this.syncActorViewport();
  }
  private syncActorViewport() {
    if(!this.actorCache)return;
    const camera=this.cameras.main;
    const width=camera.width/camera.zoom,height=camera.height/camera.zoom;
    const left=camera.scrollX+(camera.width-width)/2,top=camera.scrollY+(camera.height-height)/2;
    this.actorCache.sync({left,top,right:left+width,bottom:top+height});
  }
  private unit(pos: Position, color: number, label: string, active: boolean, rank?: number, completed = false, appearance?: Appearance, health?: Pick<Unit, "hp" | "maxHp" | "side" | "healthVisibility">, motionKey?: string, actorWorldFacing?: WorldFacing, actorRestIsActive = false) {
    const firstChild=this.children.list.length;
    const p = this.calculateActorPlacement(pos, appearance),
      g = this.add.graphics();
    const size = actorSize(appearance);
    const depth = p.depth + TERRAIN_DEPTH.actor;
    g.setDepth(depth);
    const height = drawActor(g, p.x, p.y, color, appearance ? appearance.appearance ?? "slime" : "human",
      size.scale, size.tiles, screenFacing(actorWorldFacing ?? "row_positive", this.rotation), appearance?.monsterTypeId, motionKey, !appearance && !this.state?.battle && !actorRestIsActive ? FIELD_CHARACTER_VERTICAL_OFFSET : 0, actorRestIsActive);
    if (actorRestIsActive && !appearance && !this.state?.battle) {
      const recoveryEffectGraphics = this.add.graphics().setDepth(depth + ACTOR_DEPTH.labelOffset);
      this.restRecoveryEffects.push({graphics:recoveryEffectGraphics,x:p.x,y:p.y,height,depth:depth + ACTOR_DEPTH.labelOffset});
      drawRestRecoveryEffect(recoveryEffectGraphics,p.x,p.y,height,0);
    }
    for (const createdActorChild of this.children.list.slice(firstChild)) {
      if (createdActorChild instanceof Phaser.GameObjects.Image) createdActorChild.setData('actorSelectionPosition', {...pos});
    }
    const annotation = this.add.graphics().setDepth(this.annotationDepth());
    const selected = this.selected?.column === pos.column && this.selected.row === pos.row;
    if (active || selected) {
      g.lineStyle(ACTOR_GROUND_SELECTION.lineWidth, active ? COLORS.player : COLORS.selected, ACTOR_GROUND_SELECTION.alpha);
      g.strokeEllipse(p.x, p.y, TILE_W * ACTOR_GROUND_SELECTION.widthRatio, TILE_H * ACTOR_GROUND_SELECTION.heightRatio);
    }
    if (rank !== undefined) {
      annotation.fillStyle(active ? COLORS.player : completed ? COLORS.blocked : 0x10202a);
      const badgeY=p.y-height-TURN_BADGE_OFFSET;
      if (health?.side === "enemy") annotation.fillRoundedRect(p.x-TURN_BADGE_RADIUS,badgeY-TURN_BADGE_RADIUS,TURN_BADGE_RADIUS*2,TURN_BADGE_RADIUS*2,3);
      else annotation.fillCircle(p.x,badgeY,TURN_BADGE_RADIUS);
      annotation.lineStyle(2, active ? 0xffffff : color, completed ? 0.4 : 1);
      if (health?.side === "enemy") annotation.strokeRoundedRect(p.x-TURN_BADGE_RADIUS,badgeY-TURN_BADGE_RADIUS,TURN_BADGE_RADIUS*2,TURN_BADGE_RADIUS*2,3);
      else annotation.strokeCircle(p.x,badgeY,TURN_BADGE_RADIUS);
      this.add.text(p.x, p.y - height - TURN_BADGE_OFFSET, String(rank), {
        fontFamily: "sans-serif", fontSize: "14px", fontStyle: "bold",
        color: active ? "#10202a" : completed ? "#8395a0" : "#ffffff",
      }).setOrigin(CENTER).setDepth(this.annotationDepth() + ACTOR_DEPTH.labelOffset);
    } else if (active || selected) {
      this.add.text(p.x, p.y - height - LABEL_OFFSET / 2, label, appearance ? { ...TEXT, color: `#${color.toString(16).padStart(6, "0")}` } : TEXT).setOrigin(CENTER, 1).setDepth(this.annotationDepth() + ACTOR_DEPTH.labelOffset);
    }
    if(motionKey)for(const child of this.children.list.slice(firstChild)){
      const object=child as Phaser.GameObjects.Image;
      this.movingObjects.push({key:motionKey,object,x:object.x,y:object.y,depth:object.depth});
    }
    return this.children.list.slice(firstChild);
  }
}
