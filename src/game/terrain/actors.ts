import Phaser from "phaser";
import { TILE_W, TILE_H } from "./meadow";

export const HUMAN_HEIGHT = 60;
export const SLIME_RATIO = 0.5;
export const MAX_MONSTER_RATIO = 2;
const FOOTPRINT = { fillAlpha: .12, lineAlpha: .4, lineWidth: 1, shadowWidth: .8, shadowHeight: .65 };
const HEADS = 5;
const HALF = 0.5;
const SHADOW = { color: 0x18392e, alpha: 0.3, width: 0.54, height: 0.24, coreAlpha: 0.24, coreScale: 0.65 };
const MONSTER_RING = { alpha: 0.45, width: 1 };
const PALETTE = {
  human: { legs: 0x283c50, face: 0xf1c6a1, hair: 0x413630 },
  eyes: 0x10202a,
};
// 머리 높이 단위의 x/y/폭/높이/모서리 반경이다.
const LEGS = [[-.8, -2, .65, 2, .15], [.15, -2, .65, 2, .15]];
const TUNIC = [[-.85, -4, 1.7, 2, .2], [-1.3, -3.9, .45, 1.8, .2], [.85, -3.9, .45, 1.8, .2]];
const HAIR = [-.5, -5, 1, .35, .12];
const FACE = { y: -4.5, radius: .5, eyeX: .18, eyeRadius: .06 };
const MONSTER_SPRITES = {
  slime: { key: "monster-slime-v1", url: new URL("../../assets/monsters/slime-v1.png", import.meta.url).href, top: 239, bottom: 1080 },
  beast: { key: "monster-beast-v1", url: new URL("../../assets/monsters/beast-v1.png", import.meta.url).href, top: 93, bottom: 1170 },
  giant: { key: "monster-giant-v1", url: new URL("../../assets/monsters/giant-v1.png", import.meta.url).href, top: 9, bottom: 1242 },
} as const;
const SPRITE_DEPTH_OFFSET = 0.01;

export function preloadMonsters(scene: Phaser.Scene) {
  for (const { key, url } of Object.values(MONSTER_SPRITES)) scene.load.image(key, url);
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
  const h = height / HEADS;
  g.fillStyle(SHADOW.color, SHADOW.alpha);
  g.fillEllipse(x, y, width * SHADOW.width, groundHeight * SHADOW.height);
  g.fillStyle(SHADOW.color, SHADOW.coreAlpha);
  g.fillEllipse(x, y, width * SHADOW.width * SHADOW.coreScale, groundHeight * SHADOW.height * SHADOW.coreScale);
  if (kind !== "human") {
    g.lineStyle(MONSTER_RING.width, color, MONSTER_RING.alpha);
    g.strokeEllipse(x, y, width * SHADOW.width, groundHeight * SHADOW.height);
  }
  if (kind === "human") {
    const palette = PALETTE.human;
    const rectangle = ([dx, dy, width, tall, radius]: number[]) =>
      g.fillRoundedRect(x + dx * h, y + dy * h, width * h, tall * h, radius * h);
    g.fillStyle(palette.legs);
    LEGS.forEach(rectangle);
    g.fillStyle(color);
    TUNIC.forEach(rectangle);
    g.fillStyle(palette.face);
    g.fillCircle(x, y + h * FACE.y, h * FACE.radius);
    g.fillStyle(palette.hair);
    rectangle(HAIR);
    g.fillStyle(PALETTE.eyes);
    g.fillCircle(x - h * FACE.eyeX, y + h * FACE.y, h * FACE.eyeRadius);
    g.fillCircle(x + h * FACE.eyeX, y + h * FACE.y, h * FACE.eyeRadius);
  } else {
    const sprite = MONSTER_SPRITES[kind];
    if (!g.scene.textures.exists(sprite.key)) throw new Error(`몬스터 이미지가 로드되지 않았습니다: ${sprite.key}`);
    const image = g.scene.add.image(x, y, sprite.key);
    // 원본의 투명 여백을 유지하면서 실제 몸체 높이와 발밑을 맞춘다.
    image.setOrigin(HALF, sprite.bottom / image.height)
      .setScale(height / (sprite.bottom - sprite.top))
      .setDepth(g.depth + SPRITE_DEPTH_OFFSET);
    if (!image.preFX) throw new Error("몬스터 외곽선 효과를 지원하는 WebGL 렌더러가 필요합니다.");

  }
  return height;
}
