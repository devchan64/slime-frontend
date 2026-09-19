import Phaser from "phaser";
import { TILE_W, TILE_H } from "./meadow";

export const HUMAN_HEIGHT = 60;
export const SLIME_RATIO = 0.5;
export const MAX_MONSTER_RATIO = 2;
const FOOTPRINT = { fillAlpha: .12, lineAlpha: .4, lineWidth: 1, shadowWidth: .8, shadowHeight: .65 };
const HALF = 0.5;
const SHADOW = { color: 0x18392e, alpha: 0.3, width: 0.54, height: 0.24, coreAlpha: 0.24, coreScale: 0.65 };
const MONSTER_RING = { alpha: 0.45, width: 1 };
const ACTOR_SPRITES = {
  human: { key: "character-default-v1", url: new URL("../../assets/characters/default-v1.png", import.meta.url).href, top: 50, bottom: 1218 },
  slime: { key: "monster-slime-v2", url: new URL("../../assets/monsters/slime-v2.png", import.meta.url).href, top: 278, bottom: 1074 },
  beast: { key: "monster-beast-v2", url: new URL("../../assets/monsters/beast-v2.png", import.meta.url).href, top: 132, bottom: 1176 },
  giant: { key: "monster-giant-v2", url: new URL("../../assets/monsters/giant-v2.png", import.meta.url).href, top: 31, bottom: 1227 },
} as const;
const SPRITE_DEPTH_OFFSET = 0.01;

export function preloadActors(scene: Phaser.Scene) {
  for (const { key, url } of Object.values(ACTOR_SPRITES)) scene.load.image(key, url);
}

// 발밑 좌표가 논리 셀이다. 사람은 머리 1 : 몸통 2 : 다리 2의 5등신이다.
export function drawActor(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number,
  kind: "human" | "slime" | "beast" | "giant", ratio: number, tiles: number) {
  if (!Number.isFinite(ratio) || ratio < SLIME_RATIO || ratio > MAX_MONSTER_RATIO)
    throw new Error(`지원하지 않는 몬스터 크기입니다: ${ratio}`);
  if (tiles !== 1 && tiles !== 2) throw new Error(`지원하지 않는 표시 영역입니다: ${tiles}`);
  const width = TILE_W * tiles, groundHeight = TILE_H * tiles;
  const footprint = [new Phaser.Geom.Point(x, y - groundHeight * HALF),
    new Phaser.Geom.Point(x + width * HALF, y), new Phaser.Geom.Point(x, y + groundHeight * HALF),
    new Phaser.Geom.Point(x - width * HALF, y)];
  g.fillStyle(color, FOOTPRINT.fillAlpha);
  g.fillPoints(footprint, true);
  g.lineStyle(FOOTPRINT.lineWidth, color, FOOTPRINT.lineAlpha);
  g.strokePoints(footprint, true);
  const height = kind === "human" ? HUMAN_HEIGHT : HUMAN_HEIGHT * ratio;
  g.fillStyle(SHADOW.color, SHADOW.alpha);
  g.fillEllipse(x, y, width * SHADOW.width, groundHeight * SHADOW.height);
  g.fillStyle(SHADOW.color, SHADOW.coreAlpha);
  g.fillEllipse(x, y, width * SHADOW.width * SHADOW.coreScale, groundHeight * SHADOW.height * SHADOW.coreScale);
  if (kind !== "human") {
    g.lineStyle(MONSTER_RING.width, color, MONSTER_RING.alpha);
    g.strokeEllipse(x, y, width * SHADOW.width, groundHeight * SHADOW.height);
  }
  const sprite = ACTOR_SPRITES[kind];
  if (!g.scene.textures.exists(sprite.key)) throw new Error(`개체 이미지가 로드되지 않았습니다: ${sprite.key}`);
  const image = g.scene.add.image(x, y, sprite.key);
  // 원본의 투명 여백을 유지하면서 실제 몸체 높이와 발밑을 맞춘다.
  image.setOrigin(HALF, sprite.bottom / image.height)
    .setScale(height / (sprite.bottom - sprite.top))
    .setDepth(g.depth + SPRITE_DEPTH_OFFSET);
  return height;
}
