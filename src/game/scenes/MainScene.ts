import { toView, fromView, rotatedSurface, nextRotation, rotateConnections, type MapRotation } from "../terrain/rotation";
import type { Surface } from "../terrain/elevation";
import { terrainRenderSignature, overlayCells } from '../terrain/renderPlan';
import Phaser from "phaser";
import type { State, Position, Unit } from "../../client/types";
import { buildMeadowRoad, meadowTile, TILE_W, TILE_H } from "../terrain/meadow";
import { createTerrainAtlas, preloadTerrain, TERRAIN_ATLAS } from "../terrain/textures";
import { drawWaypoint, waypointMarkerScale } from "../terrain/waypoint";
import { drawBlockedTerrain } from "../terrain/scenery";
import { constrainBackdropCamera, createBackdrop, fitBackdrop, preloadBackdrop } from "../terrain/backdrop";
import { drawActor, preloadActors } from "../terrain/actors";
import type { Appearance } from "../../client/types";
import { actorSize } from "../terrain/sizes";
import { roadConnections, roadFrame, waterConnections } from "../terrain/roadTiles";
import { drawCliffs, drawElevationTile } from "../terrain/terraces";
import {project, pickSurface, cellDepth, TERRAIN_DEPTH} from "../terrain/elevation";
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
  ZOOM = 1.7,
  LABEL_OFFSET = 25,
  BATTLE_ZOOM = 1.15,
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
const MOVE_OVERLAY = {
  fill: 0x168ee0, alpha: 0.5, pathFill: 0x62dcff, pathAlpha: 0.62,
  outline: 0x071e35, outlineWidth: 6, edge: 0x9ceaff, edgeWidth: 3,
  arrivalInset: 0.72, arrivalWidth: 2, targetWidth: 4, selectedWidth: 4,
};
const ACTOR_DEPTH = { labelOffset: 0.01 };
export class MainScene extends Phaser.Scene {
  private state: State | null = null;
  private selected: Position | null = null;
  private rotation: MapRotation = 0;
  private viewSurface: Surface | null = null;
  private panStart: {x:number;y:number;scrollX:number;scrollY:number} | null = null;
  private battleMode: "MOVE" | "ATTACK" | null = null;
  private onSelect: (p: Position) => void;
  private previousMap = "";
  private preparedLocation = "";
  private onReady: (location: string) => void;
  private loadFailed = false;
  private onFailure: (message: string) => void;
  private reachable = new Set<string>();
  private terrainObjects = new Set<Phaser.GameObjects.GameObject>();
  private backdropLayer: Phaser.GameObjects.Image | null = null;
  private terrainSignature = "";
  private waypointMarkers: Phaser.GameObjects.Container[] = [];
  private waypointZoom = 0;
  constructor(onSelect: (p: Position) => void, onReady: (location: string) => void, onFailure: (message: string) => void) {
    super("world");
    this.onSelect = onSelect;
    this.onReady = onReady;
    this.onFailure = onFailure;
  }
  preload() {
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      this.loadFailed = true;
      this.onFailure("맵 자원을 불러오지 못했습니다. 다시 접속해 주세요.");
    });
    preloadTerrain(this);
    preloadActors(this);
    preloadBackdrop(this);
  }
  create() {
    if (this.loadFailed) return;
    // 화면 회전 후 새 캔버스 크기를 기준으로 전장을 다시 맞춘다.
    const resize = () => this.game.events.once(Phaser.Core.Events.POST_STEP, this.focus, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, resize);
      this.game.events.off(Phaser.Core.Events.POST_STEP, this.focus, this);
    });
    try { createTerrainAtlas(this); }
    catch {
      this.loadFailed = true;
      this.onFailure("맵 화면을 구성하지 못했습니다. 다시 접속해 주세요.");
      return;
    }
    this.cameras.main.setZoom(ZOOM);
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
      const picked = pickSurface(at.x, at.y, this.viewSurface!);
      const cell = picked ? fromView(picked, this.surface(), this.rotation) : null;
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
    this.viewSurface = rotatedSurface(this.surface(), this.rotation);
    this.panStart = null;
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
    this.state = s;
    this.viewSurface = rotatedSurface(this.surface(), this.rotation);
    if (this.sys.isActive()) this.draw();
  }
  update() {
    if (this.backdropLayer?.visible) constrainBackdropCamera(this.backdropLayer, this.cameras.main);
    const zoom = this.cameras.main.zoom;
    if (zoom === this.waypointZoom) return;
    for (const marker of this.waypointMarkers) marker.setScale(waypointMarkerScale(zoom));
    this.waypointZoom = zoom;
  }
  focus() {
    if (this.state) {
      const battle = this.state.battle;
      const extent = battle ? battle.field.columns + battle.field.rows : 0;
      const widthFit = this.cameras.main.width / (extent * TILE_W / 2 + CAMERA_PADDING);
      const heightFit = this.cameras.main.height / (extent * TILE_H / 2 + CAMERA_PADDING);
      this.cameras.main.setZoom(battle ? Math.min(BATTLE_ZOOM,
        this.cameras.main.width < this.cameras.main.height ? Math.min(heightFit, widthFit * PORTRAIT_BATTLE_FILL) : Math.min(widthFit, heightFit)) : ZOOM);
      if (battle && this.backdropLayer) {
        const cover = Math.max(this.cameras.main.width / this.backdropLayer.displayWidth,
          this.cameras.main.height / this.backdropLayer.displayHeight);
        this.cameras.main.setZoom(Math.min(BATTLE_ZOOM, Math.max(this.cameras.main.zoom, cover)));
      }
      if (battle) this.cameras.main.setZoom(Math.min(ZOOM_MAX, this.cameras.main.zoom * BATTLE_DISPLAY_SCALE));
      const point = this.project(
        this.state.battle ? { column: (this.state.battle.field.columns - 1) / 2, row: (this.state.battle.field.rows - 1) / 2 } : this.state.me.position,
      );
      this.cameras.main.centerOn(point.x, point.y);
    }
  }
  private draw() {
    const s = this.state;
    if (!s || this.loadFailed) return;
    for (const child of [...this.children.list])
      if (!this.terrainObjects.has(child) && child !== this.backdropLayer) child.destroy();
    this.waypointMarkers = [];
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
          g.setDepth(TERRAIN_DEPTH.annotation);
          g.lineStyle(s.battle ? MOVE_OVERLAY.selectedWidth : 2, COLORS.selected);
          g.strokePoints(this.points(polygon), true);
        }
      }
    if (selectedMove && s.battle) {
      const g = this.add.graphics().setDepth(TERRAIN_DEPTH.annotation);
      const actor = s.battle.units.find(u => u.id === s.me.id)!;
      const points = [actor.position, ...selectedMove.path].map(p => this.project(p));
      g.lineStyle(PATH_WIDTH, PATH_COLOR, 1);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
      for (const [index, point] of points.slice(1).entries()) {
        g.fillStyle(PATH_COLOR);
        g.fillCircle(point.x, point.y, PATH_NODE_RADIUS);
        this.add.text(point.x, point.y, String(index + 1), {
          fontFamily: "sans-serif", fontSize: "10px", fontStyle: "bold", color: "#10202a",
        }).setOrigin(CENTER).setDepth(TERRAIN_DEPTH.annotation);
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
          this.unit(
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
            unit,
          );
    } else {
      for (const gate of s.map.connections) {
        const p = this.project(gate);
        this.waypointMarkers.push(drawWaypoint(this, gate, p.x, p.y).setDepth(TERRAIN_DEPTH.annotation));
      }
      for (const m of s.monsters.filter(monster => monster.state !== "COOLDOWN"))
        this.unit(
          m.position,
          m.disposition === "AGGRESSIVE" ? COLORS.enemy : COLORS.passive,
          m.name || "슬라임",
          false, undefined, false, m,
        );
      for (const member of s.members)
        if (member.mode !== "IN_BATTLE")
          this.unit(
            member.position,
            member.id === s.me.id ? COLORS.player : COLORS.other,
            member.name,
            member.id === s.me.id,
          );
    }
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
      this.focus();
    }
  }
  private surface = () => this.state!.battle?.field ?? this.state!.map;
  private viewPosition = (p: Position) => toView(p, this.surface(), this.rotation);
  private project = (p: Position) => project(this.viewPosition(p), this.viewSurface!);
  private depth = (p: Position) => cellDepth(this.viewPosition(p));

  private updateTerrain(s: State, visible: boolean) {
    for (const object of this.terrainObjects) (object as Phaser.GameObjects.Image).setVisible(visible);
    this.backdropLayer?.setVisible(visible);
    if (!visible) { this.cameras.main.removeBounds(); return; }
    const field = s.battle?.field, definition = field ?? s.map;
    const theme = field?.environment?.themeId ?? s.map.id;
    const blocked = s.battle?.blocked ?? s.map.blocked;
    const cells = new Map(field?.cells?.map(cell => [`${cell.column},${cell.row}`, cell.terrain]));
    if (!this.backdropLayer) this.backdropLayer = createBackdrop(this);
    fitBackdrop(this.backdropLayer, this.cameras.main,
      this.project({column:(definition.columns-1)/2,row:(definition.rows-1)/2}),
      (definition.columns+definition.rows)*TILE_W/2,(definition.columns+definition.rows)*TILE_H/2,theme);
    this.backdropLayer.setAlpha(.5);
    const signature=terrainRenderSignature(s,this.rotation);
    if(signature===this.terrainSignature && this.terrainObjects.size) return;
    for(const object of this.terrainObjects)object.destroy();
    this.terrainObjects.clear();
    const remember = <T extends Phaser.GameObjects.GameObject>(object:T):T => {this.terrainObjects.add(object);return object;};
    const road=field ? new Set([...cells].filter(([,kind])=>kind==='road').map(([key])=>key)) : buildMeadowRoad(s.map);
    const blockedCells=new Set(blocked.map(p=>`${p.column},${p.row}`));
    const waterCells = field ? new Set([...cells].filter(([, kind]) => kind === "water").map(([key]) => key))
      : theme === "mist-lake" ? blockedCells : new Set<string>();
    for(let row=0;row<definition.rows;row++)for(let column=0;column<definition.columns;column++){
      const cell={column,row},p=this.project(cell),depth=this.depth(cell);
      if(field){
        const grid=remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.overlay));
        grid.lineStyle(1,COLORS.edge,.5);
        grid.strokePoints(this.points([p.x,p.y-TILE_H/2,p.x+TILE_W/2,p.y,p.x,p.y+TILE_H/2,p.x-TILE_W/2,p.y]),true);
      }
      const terrain=field ? cells.get(`${column},${row}`) : meadowTile(column,row,road);
      if(!terrain)throw new Error(`전장 지형이 없습니다: ${column},${row}`);
      const kind=terrain==='water'?'dew':terrain==='rock'||terrain==='thicket'?'grass':terrain;
      const elevationTile=this.viewSurface!.elevationTiles?.find(t=>t.cell.column===this.viewPosition(cell).column&&t.cell.row===this.viewPosition(cell).row);
      if(elevationTile){
        drawElevationTile(remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.surface)),elevationTile,this.viewSurface!);
        continue;
      }
      const sides=remember(this.add.graphics().setDepth(depth));
      drawCliffs(sides,this.viewPosition(cell),this.viewSurface!);
      const isWater = waterCells.has(`${column},${row}`);
      const frame = isWater ? `water-${rotateConnections(waterConnections(cell, definition, waterCells), this.rotation)}`
        : kind === 'road' ? roadFrame(rotateConnections(roadConnections(cell, definition, road), this.rotation)) : kind;
      remember(this.add.image(p.x,p.y,TERRAIN_ATLAS,frame)
        .setDisplaySize(TILE_W,TILE_H).setDepth(depth+TERRAIN_DEPTH.surface));
      if (!isWater && blockedCells.has(`${column},${row}`)) {
        const detail=remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.surface+1));
        const obstacleKind=terrain==='water'||terrain==='rock'||terrain==='thicket'?terrain:undefined;
        drawBlockedTerrain(detail,cell,p.x,p.y,theme,obstacleKind);
      }
    }
    this.terrainSignature=signature;
  }

  private points(values: number[]) {
    const result = [];
    for (let i = 0; i < values.length; i += 2)
      result.push(new Phaser.Geom.Point(values[i], values[i + 1]));
    return result;
  }
  private unit(pos: Position, color: number, label: string, active: boolean, rank?: number, completed = false, appearance?: Appearance, health?: Pick<Unit, "hp" | "maxHp" | "side" | "healthVisibility">) {
    const p = this.project(pos),
      g = this.add.graphics();
    const size = actorSize(appearance);
    const depth = this.depth(pos) + TERRAIN_DEPTH.actor;
    g.setDepth(depth);
    const height = drawActor(g, p.x, p.y, color, appearance ? appearance.appearance ?? "slime" : "human",
      size.scale, size.tiles);
    if (active) {
      g.lineStyle(2, 0xffffff);
      g.strokeEllipse(p.x, p.y + 4, 30, 14);
    }
    const annotation = this.add.graphics().setDepth(TERRAIN_DEPTH.annotation);
    const selected = this.selected?.column === pos.column && this.selected.row === pos.row;
    if (active || selected) {
      annotation.lineStyle(2, active ? COLORS.player : COLORS.selected, .9);
      annotation.strokeEllipse(p.x, p.y, TILE_W * .55, TILE_H * .55);
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
      }).setOrigin(CENTER).setDepth(TERRAIN_DEPTH.annotation + ACTOR_DEPTH.labelOffset);
    } else if (active || selected) {
      this.add.text(p.x, p.y - height - LABEL_OFFSET / 2, label, appearance ? { ...TEXT, color: `#${color.toString(16).padStart(6, "0")}` } : TEXT).setOrigin(CENTER, 1).setDepth(TERRAIN_DEPTH.annotation + ACTOR_DEPTH.labelOffset);
    }
  }
}
