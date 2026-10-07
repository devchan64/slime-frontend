import { DEFAULT_CHARACTER_WALK_ASSET, updateCharacterAnimationFrame } from "../animation/walkingActors";
import {CHARACTER_BODY_HEIGHT} from "./renderMetrics";
import Phaser from "phaser";
import type { Direction } from "../animation/cellAnimation";
import { ACTOR_IDLE_TEXTURES, ACTOR_IDLE_ASSETS, createActorIdleImage, type IdleActorKind } from "../animation/idleActors";
import {drawFieldActorContactShadow} from '../../../packages/field-renderer/field-renderer.mjs';

export const HUMAN_HEIGHT = CHARACTER_BODY_HEIGHT;
// 앉은 높이는 시트 포즈로 표현하고 입식 기준 배율은 유지한다.
const HUMAN_REST_HEIGHT_RATIO = 1;
export const SLIME_RATIO = 0.5;
export const MAX_MONSTER_RATIO = 2;
/** 사람(중형) 기준 접지 그림자의 모든 맵 필드 공용 렌더링 계약이다. */
/** 시인성 검수에서 채택한 접지 대비 강화안을 모든 필드의 기본값으로 사용한다. */
export const ACTOR_CONTACT_SHADOW_CONTRACT = Object.freeze({profile:'contrast'});
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
  // 야외·전투·마을 필드의 모든 액터가 사람(중형) 기준 그림자 계약을 공유한다.
  drawFieldActorContactShadow(g,{x,y},ACTOR_CONTACT_SHADOW_CONTRACT.profile);
  const selectedIdleKind = kind === "human" && actorRestIsActive ? "human-rest" : actorMonsterTypeId && Object.hasOwn(ACTOR_IDLE_ASSETS, actorMonsterTypeId)
    ? actorMonsterTypeId as IdleActorKind : kind;
  if (!actorStableIdentifier) throw new Error("개체 대기 ID가 누락되었습니다.");
  createActorIdleImage(g.scene, selectedIdleKind, {x, y: y + actorVerticalOffset}, height, actorScreenDirection, actorStableIdentifier)
    .setDepth(g.depth + SPRITE_DEPTH_OFFSET);
  return height;
}
