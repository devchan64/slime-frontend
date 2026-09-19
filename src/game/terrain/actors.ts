import Phaser from "phaser";

export const HUMAN_HEIGHT = 60;
export const SLIME_RATIO = 1 / 3;
export const MAX_MONSTER_RATIO = 5;
const HEADS = 5;
const HALF = 0.5;
const SHADOW = { color: 0x07171b, alpha: 0.25, width: 0.65, height: 0.2 };
const PALETTE = {
  human: { legs: 0x283c50, face: 0xf1c6a1, hair: 0x413630 },
  giant: { legs: 0x564b38, face: 0x9a9a65, hair: 0x415931, tunic: 0x6a8150 },
  eyes: 0x10202a,
};
// 머리 높이 단위의 x/y/폭/높이/모서리 반경이다.
const LEGS = [[-.8, -2, .65, 2, .15], [.15, -2, .65, 2, .15]];
const TUNIC = [[-.85, -4, 1.7, 2, .2], [-1.3, -3.9, .45, 1.8, .2], [.85, -3.9, .45, 1.8, .2]];
const HAIR = [-.5, -5, 1, .35, .12];
const FACE = { y: -4.5, radius: .5, eyeX: .18, eyeRadius: .06 };
const BLOB = { width: 1.25, eyeX: .18, eyeY: -.5, eyeRadius: .065,
  shineX: -.2, shineY: -.7, shineWidth: .25, shineHeight: .15, shineAlpha: .3 };
const EARS = [[-.4, -.8, -.5, -1, -.15, -.9], [.4, -.8, .5, -1, .15, -.9]];

// 발밑 좌표가 논리 셀이다. 사람은 머리 1 : 몸통 2 : 다리 2의 5등신이다.
export function drawActor(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number,
  kind: "human" | "slime" | "beast" | "giant", ratio: number) {
  if (!Number.isFinite(ratio) || ratio < SLIME_RATIO || ratio > MAX_MONSTER_RATIO)
    throw new Error(`지원하지 않는 몬스터 크기입니다: ${ratio}`);
  const height = kind === "human" ? HUMAN_HEIGHT : HUMAN_HEIGHT * ratio;
  const h = height / HEADS;
  g.fillStyle(SHADOW.color, SHADOW.alpha);
  g.fillEllipse(x, y, height * SHADOW.width, height * SHADOW.height);
  if (kind === "human" || kind === "giant") {
    const palette = PALETTE[kind];
    const rectangle = ([dx, dy, width, tall, radius]: number[]) =>
      g.fillRoundedRect(x + dx * h, y + dy * h, width * h, tall * h, radius * h);
    g.fillStyle(palette.legs);
    LEGS.forEach(rectangle);
    g.fillStyle(kind === "human" ? color : PALETTE.giant.tunic);
    TUNIC.forEach(rectangle);
    g.fillStyle(palette.face);
    g.fillCircle(x, y + h * FACE.y, h * FACE.radius);
    g.fillStyle(palette.hair);
    rectangle(HAIR);
    g.fillStyle(PALETTE.eyes);
    g.fillCircle(x - h * FACE.eyeX, y + h * FACE.y, h * FACE.eyeRadius);
    g.fillCircle(x + h * FACE.eyeX, y + h * FACE.y, h * FACE.eyeRadius);
  } else {
    g.fillStyle(color);
    g.fillEllipse(x, y - height * HALF, height * BLOB.width, height);
    if (kind === "beast") for (const [ax, ay, bx, by, cx, cy] of EARS)
      g.fillTriangle(x + height * ax, y + height * ay, x + height * bx, y + height * by,
        x + height * cx, y + height * cy);
    g.fillStyle(0xffffff, BLOB.shineAlpha);
    g.fillEllipse(x + height * BLOB.shineX, y + height * BLOB.shineY,
      height * BLOB.shineWidth, height * BLOB.shineHeight);
    g.fillStyle(PALETTE.eyes);
    g.fillCircle(x - height * BLOB.eyeX, y + height * BLOB.eyeY, height * BLOB.eyeRadius);
    g.fillCircle(x + height * BLOB.eyeX, y + height * BLOB.eyeY, height * BLOB.eyeRadius);
  }
  return height;
}
