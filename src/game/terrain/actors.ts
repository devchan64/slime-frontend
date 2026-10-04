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
/** 사람(중형) 기준 접지 그림자의 모든 맵 필드 공용 렌더링 계약이다. */
export const ACTOR_CONTACT_SHADOW_CONTRACT = Object.freeze({
  medium: Object.freeze({ color: 0x18392e, alpha: 0.3, width: 0.4, height: 0.32, coreAlpha: 0.24, coreScale: 0.65 }),
  allFields: Object.freeze({ scale: 1.3, opacityScale: 1.5 }),
});
const SPRITE_DEPTH_OFFSET = 0.01;
export const updateCharacterFacing = updateCharacterAnimationFrame;

export function preloadActors(scene: Phaser.Scene) {
  for (const { key, url } of [...ACTOR_IDLE_TEXTURES, DEFAULT_CHARACTER_WALK_ASSET]) scene.load.image(key, url);
}

// 발밑 좌표가 논리 셀이다. 사람은 머리 1 : 몸통 2 : 다리 2의 5등신이다.
export function drawActor(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number,
  kind: "human" | "slime" | "beast" | "giant", ratio: number, tiles: number, actorScreenDirection: Direction = "down_left", actorMonsterTypeId?: string, actorStableIdentifier?: string, actorVerticalOffset: number = 0, actorRestIsActive: boolean = false) {
  if (!Number.isFinite(ratio) || ratio < SLIME_RATIO || ratio > MAX_MONSTER_RATIO)
    throw new Error(`지원하지 않는 몬스터 크기입니다: ${ratio}`);
  if (tiles !== 1 && tiles !== 2) throw new Error(`지원하지 않는 표시 영역입니다: ${tiles}`);
  const height = kind === "human" ? HUMAN_HEIGHT * (actorRestIsActive ? HUMAN_REST_HEIGHT_RATIO : 1) : HUMAN_HEIGHT * ratio;
  // 야외·전투·마을 필드의 모든 액터가 사람(중형) 기준 그림자 크기를 공유한다.
  const currentShadowScale = ACTOR_CONTACT_SHADOW_CONTRACT.allFields.scale;
  const currentShadowOpacityScale = ACTOR_CONTACT_SHADOW_CONTRACT.allFields.opacityScale;
  const contactShadowWidth = TILE_W * ACTOR_CONTACT_SHADOW_CONTRACT.medium.width * currentShadowScale;
  const contactShadowHeight = TILE_H * ACTOR_CONTACT_SHADOW_CONTRACT.medium.height * currentShadowScale;
  g.fillStyle(ACTOR_CONTACT_SHADOW_CONTRACT.medium.color, ACTOR_CONTACT_SHADOW_CONTRACT.medium.alpha * currentShadowOpacityScale);
  g.fillEllipse(x, y, contactShadowWidth, contactShadowHeight);
  g.fillStyle(ACTOR_CONTACT_SHADOW_CONTRACT.medium.color, ACTOR_CONTACT_SHADOW_CONTRACT.medium.coreAlpha * currentShadowOpacityScale);
  g.fillEllipse(x, y, contactShadowWidth * ACTOR_CONTACT_SHADOW_CONTRACT.medium.coreScale, contactShadowHeight * ACTOR_CONTACT_SHADOW_CONTRACT.medium.coreScale);
  const selectedIdleKind = kind === "human" && actorRestIsActive ? "human-rest" : actorMonsterTypeId && Object.hasOwn(ACTOR_IDLE_ASSETS, actorMonsterTypeId)
    ? actorMonsterTypeId as IdleActorKind : kind;
  if (!actorStableIdentifier) throw new Error("개체 대기 ID가 누락되었습니다.");
  createActorIdleImage(g.scene, selectedIdleKind, {x, y: y + actorVerticalOffset}, height, actorScreenDirection, actorStableIdentifier)
    .setDepth(g.depth + SPRITE_DEPTH_OFFSET);
  return height;
}
