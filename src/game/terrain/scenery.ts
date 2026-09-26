import Phaser from "phaser";
import { TILE_W, TILE_H, type Position } from "./meadow";

const STYLE = {
  shadow: 0x233f37, earth: 0x536b49, outline: 0x8eaa76,
  rock: 0x768680, rockDark: 0x526761, rockLight: 0xa3b1a0, moss: 0x789756,
  leaves: 0x356d52, leavesLight: 0x639267, leavesDark: 0x264f42,
  shadowWidth: TILE_W * 0.82, shadowHeight: TILE_H * 0.68,
  bushWidth: TILE_W * 0.43, bushHeight: TILE_H * 0.75,
  baseAlpha: 0.8, lineWidth: 1,
};
const ROCK_OUTLINE = [[-0.34, 0.04], [-0.29, -0.52], [-0.06, -0.86],
  [0.23, -0.64], [0.35, -0.1], [0.11, 0.28], [-0.16, 0.26]];
const ROCK_SHADE = [[-0.06, -0.86], [0.08, -0.29], [0.11, 0.28], [0.35, -0.1], [0.23, -0.64]];
const ROCK_TOP = [[-0.29, -0.52], [-0.06, -0.86], [0.23, -0.64], [0.08, -0.29]];
const BUSH_CLUSTERS = [[-0.23, -0.12], [0.22, -0.16], [0, -0.52], [-0.06, -0.09]];
const TILE_DIAMOND = [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]];
const MOSS = { x: -0.13, y: -0.51, width: 0.3, height: 0.18 };
const LEAF_HIGHLIGHT = { x: -0.06, y: -0.15, width: 0.24, height: 0.29 };
const THICKET_START_ROW = 10;

const points = (shape: number[][], x: number, y: number) => shape.map(([dx, dy]) =>
  new Phaser.Geom.Point(x + dx * TILE_W, y + dy * TILE_H));

// 그림은 서버 blocked 좌표에만 배치한다. 시각 장식으로 통행 판정을 추론하지 않는다.
export function drawBlockedTerrain(g: Phaser.GameObjects.Graphics, p: Position,
  x: number, y: number, mapId: string, obstacleKind?: "rock" | "thicket" | "water") {
  if (obstacleKind === "water" || (!obstacleKind && mapId === "mist-lake")) {
    g.fillStyle(0x578e9b, 0.92);
    g.fillPoints(points(TILE_DIAMOND, x, y), true);
    g.lineStyle(STYLE.lineWidth, 0xb8e2da, 0.4);
    g.lineBetween(x - STYLE.shadowWidth / 4, y, x + STYLE.shadowWidth / 4, y);
    return;
  }
  const thicket = obstacleKind ? obstacleKind === "thicket" :
    mapId === "grove" || (mapId === "meadow" && p.row > THICKET_START_ROW);
  g.fillStyle(STYLE.earth, STYLE.baseAlpha);
  g.fillPoints(points(TILE_DIAMOND, x, y), true);
  g.lineStyle(STYLE.lineWidth, STYLE.outline, STYLE.baseAlpha);
  g.strokePoints(points(TILE_DIAMOND, x, y), true);
  g.fillStyle(STYLE.shadow, 0.35);
  g.fillEllipse(x, y, STYLE.shadowWidth, STYLE.shadowHeight);
  if (thicket) {
    for (const [dx, dy] of BUSH_CLUSTERS) {
      const cx = x + dx * TILE_W, cy = y + dy * TILE_H;
      g.fillStyle(STYLE.leavesDark);
      g.fillEllipse(cx, cy, STYLE.bushWidth, STYLE.bushHeight);
      g.fillStyle(STYLE.leaves);
      g.fillEllipse(cx, cy - STYLE.lineWidth, STYLE.bushWidth, STYLE.bushHeight);
      g.fillStyle(STYLE.leavesLight, 0.8);
      g.fillEllipse(cx + LEAF_HIGHLIGHT.x * TILE_W, cy + LEAF_HIGHLIGHT.y * TILE_H,
        LEAF_HIGHLIGHT.width * TILE_W, LEAF_HIGHLIGHT.height * TILE_H);
    }
  } else {
    g.fillStyle(STYLE.rock);
    g.fillPoints(points(ROCK_OUTLINE, x, y), true);
    g.fillStyle(STYLE.rockDark);
    g.fillPoints(points(ROCK_SHADE, x, y), true);
    g.fillStyle(STYLE.rockLight);
    g.fillPoints(points(ROCK_TOP, x, y), true);
    g.fillStyle(STYLE.moss, 0.9);
    g.fillEllipse(x + MOSS.x * TILE_W, y + MOSS.y * TILE_H,
      MOSS.width * TILE_W, MOSS.height * TILE_H);
  }
}
