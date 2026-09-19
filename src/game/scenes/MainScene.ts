import Phaser from "phaser";
import type { State, Position } from "../../client/types";
import { buildMeadowRoad, meadowTile, TILE_W, TILE_H } from "../terrain/meadow";
import { createTerrainAtlas, preloadTerrain, TERRAIN_ATLAS } from "../terrain/textures";
import { drawWaypoint, waypointMarkerScale } from "../terrain/waypoint";
import { drawBlockedTerrain } from "../terrain/scenery";
import { constrainBackdropCamera, createBackdrop, fitBackdrop, preloadBackdrop } from "../terrain/backdrop";
import { drawActor, preloadMonsters } from "../terrain/actors";
import type { Appearance } from "../../client/types";
import { actorSize } from "../terrain/sizes";
import { drawTerrainDetails } from "../terrain/details";
import { drawCliffs, drawCellRoad, drawStair } from "../terrain/terraces";
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
  ZOOM = 0.85,
  LABEL_OFFSET = 25,
  BATTLE_ZOOM = 1.15,
  CAMERA_PADDING = 140,
  TURN_BADGE_OFFSET = 16,
  TURN_BADGE_RADIUS = 11,
  PATH_WIDTH = 3,
  PATH_NODE_RADIUS = 7,
  PATH_COLOR = 0x9eeeff,
  ARRIVAL_COLOR = 0xffbb66;
const ACTOR_DEPTH = { labelOffset: 0.01 };
const HEALTH_BAR = { width: 36, height: 5, offset: 5, background: 0x10202a };
export class MainScene extends Phaser.Scene {
  private state: State | null = null;
  private selected: Position | null = null;
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
    preloadMonsters(this);
    preloadBackdrop(this);
  }
  create() {
    if (this.loadFailed) return;
    try { createTerrainAtlas(this); }
    catch {
      this.loadFailed = true;
      this.onFailure("맵 화면을 구성하지 못했습니다. 다시 접속해 주세요.");
      return;
    }
    this.cameras.main.setZoom(ZOOM);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.game.canvas.closest<HTMLElement>(".canvas-wrap")?.focus({ preventScroll: true });
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      if (!this.state) return;
      const cell = pickSurface(at.x, at.y, this.state.battle?.field ?? this.state.map);
      if (cell) {
        this.selected = cell;
        this.draw();
        this.onSelect(cell);
      }
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _x: number, dy: number) =>
      this.cameras.main.setZoom(
        Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.4, 1.4),
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
      const cell = { column: base.column + dc, row: base.row + dr };
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
      this.cameras.main.setZoom(battle ? Math.min(BATTLE_ZOOM,
        this.cameras.main.width / (extent * TILE_W / 2 + CAMERA_PADDING),
        this.cameras.main.height / (extent * TILE_H / 2 + CAMERA_PADDING)) : ZOOM);
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
    const size = s.battle?.field.columns ?? s.map.columns,
      rows = s.battle?.field.rows ?? s.map.rows,
      blocked = s.battle?.blocked || s.map.blocked;
    this.reachable.clear();
    for (const move of s.battle?.tactics.moves || [])
      this.reachable.add(`${move.position.column},${move.position.row}`);
    const selectedMove = s.battle?.tactics.moves.find(m => this.selected?.column === m.position.column && this.selected.row === m.position.row);
    const previewPath = new Set((selectedMove?.path || []).map(p => `${p.column},${p.row}`));
    const arrivalRange = new Set((selectedMove?.attackRange || []).map(p => `${p.column},${p.row}`));
    const arrivalTargets = new Set((selectedMove?.attacks || []).map(a => {
      const target = s.battle!.units.find(u => u.id === a.targetId)!;
      return `${target.position.column},${target.position.row}`;
    }));
    const attackCells = new Set((s.battle?.tactics.attacks || []).map(a => {
      const target = s.battle!.units.find(u => u.id === a.targetId)!;
      return `${target.position.column},${target.position.row}`;
    }));
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < size; column++) {
        const point = this.project({ column, row });
        const g = this.add.graphics().setDepth(cellDepth({column,row}) + TERRAIN_DEPTH.overlay);
        const wall = blocked.some((p) => p.column === column && p.row === row);
        const isSafe =
          !s.battle &&
          Math.abs(column - s.map.startPoint.column) +
            Math.abs(row - s.map.startPoint.row) <=
            s.map.safeRadius;
        const color = previewPath.has(`${column},${row}`) ? 0x467f96 : wall
          ? COLORS.blocked
          : this.reachable.has(`${column},${row}`)
            ? 0x28536a
            : isSafe
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
          const highlighted = previewPath.has(`${column},${row}`) || this.reachable.has(`${column},${row}`);
          g.fillStyle(color, textured ? (meadow ? 0.16 : highlighted ? 0.38 : 0) : 1);
          g.fillPoints(this.points(polygon), true);
        }
        if (!meadow) {
          g.lineStyle(1, COLORS.edge, 0.5);
          g.strokePoints(this.points(polygon), true);
        }
        if (arrivalRange.has(`${column},${row}`)) {
          g.fillStyle(ARRIVAL_COLOR, 0.18);
          g.fillPoints(this.points(polygon), true);
          g.lineStyle(arrivalTargets.has(`${column},${row}`) ? 4 : 1, ARRIVAL_COLOR);
          g.strokePoints(this.points(polygon), true);
        }
        if (!selectedMove && attackCells.has(`${column},${row}`)) {
          g.lineStyle(3, COLORS.enemy);
          g.strokePoints(this.points(polygon), true);
        }
        if (this.selected?.column === column && this.selected.row === row) {
          g.lineStyle(2, COLORS.selected);
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
      for (const m of s.monsters)
        this.unit(
          m.position,
          m.disposition === "AGGRESSIVE" ? COLORS.enemy : COLORS.passive,
          `${m.name || "슬라임"} · ${m.disposition === "AGGRESSIVE" ? "선공" : "비선공"} · ${m.state === "AVAILABLE" ? "대기" : m.state === "COOLDOWN" ? "휴식" : "조우 중"}`,
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
  private project = (p: Position) => project(p, this.state!.battle?.field ?? this.state!.map);

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
    const signature=JSON.stringify(definition);
    if(signature===this.terrainSignature && this.terrainObjects.size) return;
    for(const object of this.terrainObjects)object.destroy();
    this.terrainObjects.clear();
    const remember = <T extends Phaser.GameObjects.GameObject>(object:T):T => {this.terrainObjects.add(object);return object;};
    const road=field ? new Set([...cells].filter(([,kind])=>kind==='road').map(([key])=>key)) : buildMeadowRoad(s.map);
    const blockedCells=new Set(blocked.map(p=>`${p.column},${p.row}`));
    for(let row=0;row<definition.rows;row++)for(let column=0;column<definition.columns;column++){
      const cell={column,row},p=this.project(cell),depth=cellDepth(cell);
      const terrain=field ? cells.get(`${column},${row}`) : meadowTile(column,row,road);
      if(!terrain)throw new Error(`전장 지형이 없습니다: ${column},${row}`);
      const kind=terrain==='water'?'dew':terrain==='rock'||terrain==='thicket'?'grass':terrain;
      const sides=remember(this.add.graphics().setDepth(depth));
      drawCliffs(sides,cell,definition);
      remember(this.add.image(p.x,p.y,TERRAIN_ATLAS,kind==='road'?'grass':kind)
        .setDisplaySize(TILE_W,TILE_H).setDepth(depth+TERRAIN_DEPTH.surface));
      const detail=remember(this.add.graphics().setDepth(depth+TERRAIN_DEPTH.surface+1));
      drawCellRoad(detail,cell,definition,road);
      if(!blockedCells.has(`${column},${row}`))drawTerrainDetails(detail,kind,column,row,p.x,p.y);
      else {
        const obstacleKind=terrain==='water'||terrain==='rock'||terrain==='thicket'?terrain:undefined;
        drawBlockedTerrain(detail,cell,p.x,p.y,theme,obstacleKind);
      }
    }
    for(const ramp of definition.ramps ?? []){
      const steps=remember(this.add.graphics().setDepth(Math.max(cellDepth(ramp.start),cellDepth(ramp.end))+TERRAIN_DEPTH.overlay-1));
      drawStair(steps,ramp.start,ramp.end,definition);
    }
    this.terrainSignature=signature;
  }

  private points(values: number[]) {
    const result = [];
    for (let i = 0; i < values.length; i += 2)
      result.push(new Phaser.Geom.Point(values[i], values[i + 1]));
    return result;
  }
  private unit(pos: Position, color: number, label: string, active: boolean, rank?: number, completed = false, appearance?: Appearance, health?: {hp:number; maxHp:number}) {
    const p = this.project(pos),
      g = this.add.graphics();
    const size = actorSize(appearance);
    const depth = cellDepth(pos) + TERRAIN_DEPTH.actor;
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
    if (health) {
      const y=p.y-height-HEALTH_BAR.offset;
      annotation.fillStyle(HEALTH_BAR.background);annotation.fillRect(p.x-HEALTH_BAR.width/2,y,HEALTH_BAR.width,HEALTH_BAR.height);
      annotation.fillStyle(color);annotation.fillRect(p.x-HEALTH_BAR.width/2,y,HEALTH_BAR.width*health.hp/health.maxHp,HEALTH_BAR.height);
    }
    if (rank !== undefined) {
      annotation.fillStyle(active ? COLORS.player : completed ? COLORS.blocked : 0x10202a);
      annotation.fillCircle(p.x, p.y - height - TURN_BADGE_OFFSET, TURN_BADGE_RADIUS);
      annotation.lineStyle(2, active ? 0xffffff : color, completed ? 0.4 : 1);
      annotation.strokeCircle(p.x, p.y - height - TURN_BADGE_OFFSET, TURN_BADGE_RADIUS);
      this.add.text(p.x, p.y - height - TURN_BADGE_OFFSET, String(rank), {
        fontFamily: "sans-serif", fontSize: "14px", fontStyle: "bold",
        color: active ? "#10202a" : completed ? "#8395a0" : "#ffffff",
      }).setOrigin(CENTER).setDepth(TERRAIN_DEPTH.annotation + ACTOR_DEPTH.labelOffset);
      if (active || selected) this.add.text(p.x, p.y + LABEL_OFFSET, health ? `${label} · ${health.hp}/${health.maxHp}` : label, TEXT).setOrigin(CENTER, 0).setDepth(TERRAIN_DEPTH.annotation + ACTOR_DEPTH.labelOffset);
    } else if (active || selected) {
      this.add.text(p.x, p.y - height - LABEL_OFFSET / 2, label, TEXT).setOrigin(CENTER, 1).setDepth(TERRAIN_DEPTH.annotation + ACTOR_DEPTH.labelOffset);
    }
  }
}
