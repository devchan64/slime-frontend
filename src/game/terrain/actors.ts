import {CHARACTER_BODY_HEIGHT} from "./renderMetrics";
import Phaser from "phaser";
import type { Direction } from "../animation/cellAnimation";
import { ACTOR_STANDING_TEXTURES, ACTOR_STANDING_ASSETS, createActorStandingImage, updateActorStandingFrame, type StandingActorKind } from "../animation/standingActors";
import { TILE_W, TILE_H } from "./meadow";

export const HUMAN_HEIGHT = CHARACTER_BODY_HEIGHT;
export const SLIME_RATIO = 0.5;
export const MAX_MONSTER_RATIO = 2;
const FOOTPRINT = { fillAlpha: .12, lineAlpha: .4, lineWidth: 1, shadowWidth: .8, shadowHeight: .65 };
const HALF = 0.5;
const SHADOW = { color: 0x18392e, alpha: 0.3, width: 0.54, height: 0.24, coreAlpha: 0.24, coreScale: 0.65 };
const HUMAN_REST_HEIGHT_RATIO = 0.55;
const HUMAN_CONTACT_SHADOW = { width: 0.32, height: 0.12 };
const MONSTER_RING = { alpha: 0.45, width: 1 };
const SPRITE_DEPTH_OFFSET = 0.01;
const REST_RECOVERY_EFFECT = { color: 0x9ff6d0, lineWidth: 3, radius: 7, rise: 18, spread: 21 };
export const updateCharacterFacing = updateActorStandingFrame;

export function drawRestRecoveryEffect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, height: number, progress: number) {
  const currentRise = REST_RECOVERY_EFFECT.rise * progress;
  const currentAlpha = 0.35 + (1 - progress) * 0.55;
  graphics.clear();
  graphics.lineStyle(REST_RECOVERY_EFFECT.lineWidth, REST_RECOVERY_EFFECT.color, currentAlpha);
  const centerY = y - height * 0.72 - currentRise;
  graphics.strokeCircle(x, centerY, REST_RECOVERY_EFFECT.radius);
  for (const currentOffset of [-REST_RECOVERY_EFFECT.spread, REST_RECOVERY_EFFECT.spread]) {
    const symbolX = x + currentOffset * (0.45 + progress * 0.55);
    const symbolY = centerY + Math.abs(currentOffset) * 0.2;
    graphics.lineBetween(symbolX - 4, symbolY, symbolX + 4, symbolY);
    graphics.lineBetween(symbolX, symbolY - 4, symbolX, symbolY + 4);
  }
}

export function preloadActors(scene: Phaser.Scene) {
  for (const { key, url } of ACTOR_STANDING_TEXTURES) scene.load.image(key, url);
}

// 발밑 좌표가 논리 셀이다. 사람은 머리 1 : 몸통 2 : 다리 2의 5등신이다.
export function drawActor(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number,
  kind: "human" | "slime" | "beast" | "giant", ratio: number, tiles: number, actorScreenDirection: Direction = "down_left", actorMonsterTypeId?: string, actorStableIdentifier?: string, actorVerticalOffset: number = 0, actorRestIsActive: boolean = false) {
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
  const height = kind === "human" ? HUMAN_HEIGHT * (actorRestIsActive ? HUMAN_REST_HEIGHT_RATIO : 1) : HUMAN_HEIGHT * ratio;
  const contactShadowWidth = width * (kind === "human" ? HUMAN_CONTACT_SHADOW.width : SHADOW.width);
  const contactShadowHeight = groundHeight * (kind === "human" ? HUMAN_CONTACT_SHADOW.height : SHADOW.height);
  g.fillStyle(SHADOW.color, SHADOW.alpha);
  g.fillEllipse(x, y, contactShadowWidth, contactShadowHeight);
  g.fillStyle(SHADOW.color, SHADOW.coreAlpha);
  g.fillEllipse(x, y, contactShadowWidth * SHADOW.coreScale, contactShadowHeight * SHADOW.coreScale);
  if (kind !== "human") {
    g.lineStyle(MONSTER_RING.width, color, MONSTER_RING.alpha);
    g.strokeEllipse(x, y, width * SHADOW.width, groundHeight * SHADOW.height);
  }
  const selectedStandingKind = kind === "human" && actorRestIsActive ? "human-rest" : actorMonsterTypeId && Object.hasOwn(ACTOR_STANDING_ASSETS, actorMonsterTypeId)
    ? actorMonsterTypeId as StandingActorKind : kind;
  if (!actorStableIdentifier) throw new Error("개체 스탠딩 ID가 누락되었습니다.");
  createActorStandingImage(g.scene, selectedStandingKind, {x, y: y + actorVerticalOffset}, height, actorScreenDirection, actorStableIdentifier)
    .setDepth(g.depth + SPRITE_DEPTH_OFFSET);
  return height;
}
