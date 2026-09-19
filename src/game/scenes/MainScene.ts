import Phaser from "phaser";
import type { State, Position } from "../../client/types";
import { buildMeadowRoad, meadowTile, TILE_W, TILE_H } from "../terrain/meadow";
import { createTerrainAtlas, preloadTerrain, TERRAIN_ATLAS } from "../terrain/textures";
import { drawWaypoint, waypointMarkerScale } from "../terrain/waypoint";
import { drawBlockedTerrain } from "../terrain/scenery";
import { constrainBackdropCamera, createBackdrop, fitBackdrop, preloadBackdrop } from "../terrain/backdrop";
import { drawActor, HUMAN_HEIGHT, SLIME_RATIO } from "../terrain/actors";
import type { Appearance } from "../../client/types";
import { drawRoad } from "../terrain/paths";
const ORIGIN_X = 1040,
  ORIGIN_Y = 80;
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
  TURN_BADGE_OFFSET = 16,
  TURN_BADGE_RADIUS = 11,
  PATH_WIDTH = 3,
  PATH_NODE_RADIUS = 7,
  PATH_COLOR = 0x9eeeff,
  ARRIVAL_COLOR = 0xffbb66;
const ACTOR_DEPTH = { base: 2, divisor: HUMAN_HEIGHT * 100, labelOffset: 0.01 };
const TERRAIN_ALPHA = { grass: 0.72, dew: 0.78, flowers: 0.8, road: 0.55 };
const BORDER = { width: 2, color: 0xc4d5a7, alpha: 0.26, halfCell: 0.5 };
const screen = (p: Position) => ({
  x: ORIGIN_X + ((p.column - p.row) * TILE_W) / 2,
  y: ORIGIN_Y + ((p.column + p.row) * TILE_H) / 2,
});
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
  private terrainLayer: Phaser.GameObjects.Container | null = null;
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
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      const u = (at.x - ORIGIN_X) / (TILE_W / 2),
        v = (at.y - ORIGIN_Y) / (TILE_H / 2);
      const cell = {
        column: Math.floor((u + v) / 2 + 0.5),
        row: Math.floor((v - u) / 2 + 0.5),
      };
      const columns = this.state?.battle?.field.columns ?? this.state?.map.columns ?? 0;
      const rows = this.state?.battle?.field.rows ?? this.state?.map.rows ?? 0;
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
    this.input.on("wheel", (_p: unknown, _o: unknown, _x: number, dy: number) =>
      this.cameras.main.setZoom(
        Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.4, 1.4),
      ),
    );
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches("input,textarea,select") ||
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
  selectCell(position: Position | null) {
    this.selected = position;
    if (this.sys.isActive()) this.draw();
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
      this.cameras.main.setZoom(this.state.battle ? BATTLE_ZOOM : ZOOM);
      const point = screen(
        this.state.battle ? { column: (this.state.battle.field.columns - 1) / 2, row: (this.state.battle.field.rows - 1) / 2 } : this.state.me.position,
      );
      this.cameras.main.centerOn(point.x, point.y);
    }
  }
  private draw() {
    const s = this.state;
    if (!s || this.loadFailed) return;
    for (const child of [...this.children.list])
      if (child !== this.terrainLayer && child !== this.backdropLayer) child.destroy();
    this.waypointMarkers = [];
    const meadow = !s.battle;
    this.updateTerrain(s, meadow);
    const g = this.add.graphics();
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
        const point = screen({ column, row });
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
          g.fillStyle(color, meadow && !wall ? 0.16 : 1);
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
      const actor = s.battle.units.find(u => u.id === s.me.id)!;
      const points = [actor.position, ...selectedMove.path].map(screen);
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
        }).setOrigin(CENTER);
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
            `${unit.name} ${unit.hp}/${unit.maxHp}`,
            unit.id === s.battle.order[s.battle.index],
            s.battle.order.indexOf(unit.id) + 1,
            s.battle.order.indexOf(unit.id) < s.battle.index,
            unit.side === "ally" ? undefined : unit,
          );
    } else {
      for (const gate of s.map.connections) {
        const p = screen(gate);
        this.waypointMarkers.push(drawWaypoint(this, gate, p.x, p.y));
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
  private updateTerrain(s: State, visible: boolean) {
    this.terrainLayer?.setVisible(visible);
    this.backdropLayer?.setVisible(visible);
    if (!visible) {
      this.cameras.main.removeBounds();
      return;
    }
    if (!this.backdropLayer) this.backdropLayer = createBackdrop(this);
    fitBackdrop(this.backdropLayer, this.cameras.main,
      screen({ column: (s.map.columns - 1) / 2, row: (s.map.rows - 1) / 2 }),
      (s.map.columns + s.map.rows) * TILE_W / 2, (s.map.columns + s.map.rows) * TILE_H / 2, s.map.id);
    const signature = JSON.stringify(s.map);
    if (signature === this.terrainSignature && this.terrainLayer) return;
    const road = buildMeadowRoad(s.map);
    this.terrainLayer?.destroy();
    this.terrainLayer = this.add.container(0, 0).setDepth(-1);
    for (let row = 0; row < s.map.rows; row++)
      for (let column = 0; column < s.map.columns; column++) {
        const p = screen({ column, row });
        const kind = meadowTile(column, row, road);
        this.terrainLayer.add(this.add.image(p.x, p.y, TERRAIN_ATLAS,
          kind === "road" ? "grass" : kind).setDisplaySize(TILE_W, TILE_H).setAlpha(TERRAIN_ALPHA[kind]));
      }
    const scenery = this.add.graphics();
    drawRoad(scenery, road, screen);
    const boundary = [
      { column: -BORDER.halfCell, row: -BORDER.halfCell },
      { column: s.map.columns - BORDER.halfCell, row: -BORDER.halfCell },
      { column: s.map.columns - BORDER.halfCell, row: s.map.rows - BORDER.halfCell },
      { column: -BORDER.halfCell, row: s.map.rows - BORDER.halfCell },
    ].map(screen).map(p => new Phaser.Geom.Point(p.x, p.y));
    scenery.lineStyle(BORDER.width, BORDER.color, BORDER.alpha);
    scenery.strokePoints(boundary, true);
    for (const blocked of [...s.map.blocked].sort((a, b) => a.column + a.row - b.column - b.row)) {
      const p = screen(blocked);
      drawBlockedTerrain(scenery, blocked, p.x, p.y, s.map.id);
    }
    this.terrainLayer.add(scenery);
    this.terrainSignature = signature;
  }
  private points(values: number[]) {
    const result = [];
    for (let i = 0; i < values.length; i += 2)
      result.push(new Phaser.Geom.Point(values[i], values[i + 1]));
    return result;
  }
  private unit(pos: Position, color: number, label: string, active: boolean, rank?: number, completed = false, appearance?: Appearance) {
    const p = screen(pos),
      g = this.add.graphics();
    const height = drawActor(g, p.x, p.y, color, appearance ? appearance.appearance ?? "slime" : "human",
      appearance ? appearance.heightRatio ?? SLIME_RATIO : 1);
    const depth = ACTOR_DEPTH.base + p.y / ACTOR_DEPTH.divisor;
    g.setDepth(depth);
    if (active) {
      g.lineStyle(2, 0xffffff);
      g.strokeEllipse(p.x, p.y + 4, 30, 14);
    }
    if (rank !== undefined) {
      g.fillStyle(active ? COLORS.player : completed ? COLORS.blocked : 0x10202a);
      g.fillCircle(p.x, p.y - height - TURN_BADGE_OFFSET, TURN_BADGE_RADIUS);
      g.lineStyle(2, active ? 0xffffff : color, completed ? 0.4 : 1);
      g.strokeCircle(p.x, p.y - height - TURN_BADGE_OFFSET, TURN_BADGE_RADIUS);
      this.add.text(p.x, p.y - height - TURN_BADGE_OFFSET, String(rank), {
        fontFamily: "sans-serif", fontSize: "14px", fontStyle: "bold",
        color: active ? "#10202a" : completed ? "#8395a0" : "#ffffff",
      }).setOrigin(CENTER).setDepth(depth + ACTOR_DEPTH.labelOffset);
      this.add.text(p.x, p.y + LABEL_OFFSET, label, TEXT).setOrigin(CENTER, 0).setDepth(depth + ACTOR_DEPTH.labelOffset);
    } else {
      this.add.text(p.x, p.y - height - LABEL_OFFSET / 2, label, TEXT).setOrigin(CENTER, 1).setDepth(depth + ACTOR_DEPTH.labelOffset);
    }
  }
}
