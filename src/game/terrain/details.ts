import Phaser from "phaser";
import { TILE_W, TILE_H, type TerrainKind } from "./meadow";

const PATCH = { count: 3, inset: .64, seedColumn: 137, seedRow: 269, seedItem: 71 };
const GRASS = { dark: 0x365d34, light: 0xa5bb64, width: 1.5, height: 7, spread: 4 };
const DEW = { stem: 0x4f7650, shine: 0xd9fff0, radius: 1.2, height: 5, spread: 3 };
const FLOWER = { stem: 0x365e3b, petals: [0xffefd1, 0xf0bdcf, 0xe9d682], center: 0x9b6b2d,
  radius: 3, centerRadius: 1.1, height: 5, spread: 5 };
const FLOWER_HEADS = [[-1, 0], [0, -.6], [1, .3]] as const;
const fraction = (seed: number) => {
  const n = Math.sin(seed) * 43758.5453;
  return n - Math.floor(n);
};

// 원본의 미세한 질감에 더해 축소 후에도 남는 풀 묶음·물기·꽃의 윤곽을 배치한다.
export function drawTerrainDetails(g: Phaser.GameObjects.Graphics, kind: TerrainKind,
  column: number, row: number, x: number, y: number) {
  if (kind === "road") return;
  // 군락 사이에 빈 지면을 남겨 전체 칸에 같은 장식이 반복되지 않게 한다.
  if (fraction(Math.floor(column / 2) * PATCH.seedColumn + Math.floor(row / 2) * PATCH.seedRow) < .42) return;
  for (let i = 0; i < PATCH.count; i++) {
    const seed = column * PATCH.seedColumn + row * PATCH.seedRow + i * PATCH.seedItem;
    const u = (fraction(seed) - .5) * PATCH.inset;
    const v = (fraction(seed + PATCH.seedItem) - .5) * PATCH.inset;
    const px = x + (u - v) * TILE_W / 2, py = y + (u + v) * TILE_H / 2;
    if (kind === "dew") {
      g.lineStyle(GRASS.width, DEW.stem, .95);
      g.lineBetween(px, py, px - DEW.spread, py - DEW.height);
      g.lineBetween(px, py, px + DEW.spread, py - DEW.height);
      g.fillStyle(DEW.shine, .95);
      g.fillCircle(px - DEW.spread, py - DEW.height, DEW.radius);
      g.fillCircle(px + DEW.spread, py - DEW.height, DEW.radius);
    } else if (kind === "flowers") {
      for (const [dx, dy] of FLOWER_HEADS) {
        const fx = px + dx * FLOWER.spread, fy = py + dy * FLOWER.spread;
        g.lineStyle(1, FLOWER.stem, .9);
        g.lineBetween(fx, fy, fx, fy - FLOWER.height);
        g.fillStyle(FLOWER.petals[(column + row + i) % FLOWER.petals.length]);
        g.fillCircle(fx, fy - FLOWER.height, FLOWER.radius);
        g.fillStyle(FLOWER.center);
        g.fillCircle(fx, fy - FLOWER.height, FLOWER.centerRadius);
      }
    } else {
      g.lineStyle(GRASS.width, GRASS.dark, .85);
      g.lineBetween(px, py, px - GRASS.spread, py - GRASS.height);
      g.lineBetween(px, py, px + GRASS.spread, py - GRASS.height);
      g.lineStyle(GRASS.width, GRASS.light, .9);
      g.lineBetween(px, py, px, py - GRASS.height);
    }
  }
}
