import Phaser from "phaser";
import { TILE_H, type Position } from "./meadow";

const ROAD = { shoulder: 0x92866a, surface: 0xcbb88d, center: 0xdfcca0,
  width: TILE_H * 0.52, shoulderWidth: TILE_H * 0.72, centerWidth: TILE_H * 0.12 };
const GRAVEL = { dark: 0x88734f, light: 0xf0ddae, width: 3.9, height: 2.34, spread: 7.8, offset: 5.2 };
const EDGES = [[1, 0], [0, 1]] as const;
const NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const SMOOTH = { center: 0.5, neighbor: 0.25 };

// 셀 경계의 사각 패턴 대신 연결된 길과 둥근 접합부를 그린다.
export function drawRoad(g: Phaser.GameObjects.Graphics, road: Set<string>,
  project: (p: Position) => { x: number; y: number }) {
  const centers = new Map<string, { x: number; y: number }>();
  for (const key of road) {
    const [column, row] = key.split(",").map(Number), p = project({ column, row });
    const neighbors = NEIGHBORS.map(([dc, dr]) => ({ column: column + dc, row: row + dr }))
      .filter(q => road.has(`${q.column},${q.row}`)).map(project);
    // 끝점·분기점을 고정하고 셀 안에서만 중심을 보정해 계단 무늬를 줄인다.
    centers.set(key, neighbors.length === 2 ? {
      x: p.x * SMOOTH.center + (neighbors[0].x + neighbors[1].x) * SMOOTH.neighbor,
      y: p.y * SMOOTH.center + (neighbors[0].y + neighbors[1].y) * SMOOTH.neighbor,
    } : p);
  }
  const layers = [
    { color: ROAD.shoulder, width: ROAD.shoulderWidth, alpha: 0.32 },
    { color: ROAD.surface, width: ROAD.width, alpha: 0.95 },
    { color: ROAD.center, width: ROAD.centerWidth, alpha: 0.35 },
  ];
  for (const layer of layers) {
    g.lineStyle(layer.width, layer.color, layer.alpha);
    g.fillStyle(layer.color, layer.alpha);
    for (const key of road) {
      const [column, row] = key.split(",").map(Number);
      const p = centers.get(key)!;
      g.fillCircle(p.x, p.y, layer.width / 2);
      for (const [dc, dr] of EDGES) {
        if (!road.has(`${column + dc},${row + dr}`)) continue;
        const q = centers.get(`${column + dc},${row + dr}`)!;
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    }
  }
  for (const [key, p] of centers) {
    const [column, row] = key.split(",").map(Number);
    const offset = (column + row) % 2 ? GRAVEL.offset : -GRAVEL.offset;
    g.fillStyle(GRAVEL.dark, .8);
    g.fillEllipse(p.x + offset, p.y, GRAVEL.width, GRAVEL.height);
    g.fillStyle(GRAVEL.light, .85);
    g.fillEllipse(p.x - offset, p.y + GRAVEL.spread / 2, GRAVEL.width, GRAVEL.height);
  }

}
