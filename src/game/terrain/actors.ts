import { DEFAULT_CHARACTER_WALK_ASSET, updateCharacterAnimationFrame } from "../animation/walkingActors";
import {CHARACTER_BODY_HEIGHT} from "./renderMetrics";
import Phaser from "phaser";
import type { Direction } from "../animation/cellAnimation";
import { ACTOR_IDLE_TEXTURES, ACTOR_IDLE_ASSETS, createActorIdleImage, type IdleActorKind } from "../animation/idleActors";
import { TILE_W, TILE_H } from "./meadow";

export const HUMAN_HEIGHT = CHARACTER_BODY_HEIGHT;
// 앉은 높이는 시트 포즈로 표현하고 입식 기준 배율은 유지한다.
const HUMAN_REST_HEIGHT_RATIO = 1;
export const SLIME_RATIO = 0.5;
export const MAX_MONSTER_RATIO = 2;
const FOOTPRINT = { fillAlpha: .12, lineAlpha: .4, lineWidth: 1, shadowWidth: .8, shadowHeight: .65 };
const HALF = 0.5;
const MEDIUM_CONTACT_SHADOW = { color: 0x18392e, alpha: 0.3, width: 0.4, height: 0.32, coreAlpha: 0.24, coreScale: 0.65 };
const FIELD_CHARACTER_SHADOW_SCALE = 1.3;
const FIELD_CHARACTER_SHADOW_OPACITY_SCALE = 1.5;
const MONSTER_RING = { alpha: 0.45, width: 1, groundWidthRatio: 0.54, groundHeightRatio: 0.24 };
const SPRITE_DEPTH_OFFSET = 0.01;
const REST_RECOVERY_EFFECT = { color: 0x9ff6d0, lineWidth: 3, radius: 7, rise: 18, spread: 21 };
export const updateCharacterFacing = updateCharacterAnimationFrame;

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
  for (const { key, url } of [...ACTOR_IDLE_TEXTURES, DEFAULT_CHARACTER_WALK_ASSET]) scene.load.image(key, url);
}

// 발밑 좌표가 논리 셀이다. 사람은 머리 1 : 몸통 2 : 다리 2의 5등신이다.
export function drawActor(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number,
  kind: "human" | "slime" | "beast" | "giant", ratio: number, tiles: number, actorScreenDirection: Direction = "down_left", actorMonsterTypeId?: string, actorStableIdentifier?: string, actorVerticalOffset: number = 0, actorRestIsActive: boolean = false, actorFieldShadowEnabled: boolean = false) {
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
  // 사람은 중형 기준이며, 나머지 크기 등급도 같은 기준 그림자에 외형 배율을 적용한다.
  const fieldCharacterShadowActive = kind === "human" && actorFieldShadowEnabled;
  const currentShadowScale = ratio * (fieldCharacterShadowActive ? FIELD_CHARACTER_SHADOW_SCALE : 1);
  const currentShadowOpacityScale = fieldCharacterShadowActive ? FIELD_CHARACTER_SHADOW_OPACITY_SCALE : 1;
  const contactShadowWidth = TILE_W * MEDIUM_CONTACT_SHADOW.width * currentShadowScale;
  const contactShadowHeight = TILE_H * MEDIUM_CONTACT_SHADOW.height * currentShadowScale;
  g.fillStyle(MEDIUM_CONTACT_SHADOW.color, MEDIUM_CONTACT_SHADOW.alpha * currentShadowOpacityScale);
  g.fillEllipse(x, y, contactShadowWidth, contactShadowHeight);
  g.fillStyle(MEDIUM_CONTACT_SHADOW.color, MEDIUM_CONTACT_SHADOW.coreAlpha * currentShadowOpacityScale);
  g.fillEllipse(x, y, contactShadowWidth * MEDIUM_CONTACT_SHADOW.coreScale, contactShadowHeight * MEDIUM_CONTACT_SHADOW.coreScale);
  if (kind !== "human") {
    g.lineStyle(MONSTER_RING.width, color, MONSTER_RING.alpha);
    g.strokeEllipse(x, y, width * MONSTER_RING.groundWidthRatio, groundHeight * MONSTER_RING.groundHeightRatio);
  }
  const selectedIdleKind = kind === "human" && actorRestIsActive ? "human-rest" : actorMonsterTypeId && Object.hasOwn(ACTOR_IDLE_ASSETS, actorMonsterTypeId)
    ? actorMonsterTypeId as IdleActorKind : kind;
  if (!actorStableIdentifier) throw new Error("개체 대기 ID가 누락되었습니다.");
  createActorIdleImage(g.scene, selectedIdleKind, {x, y: y + actorVerticalOffset}, height, actorScreenDirection, actorStableIdentifier)
    .setDepth(g.depth + SPRITE_DEPTH_OFFSET);
  return height;
}
