import { calculateIdlePhase } from "./idlePhase";
import type Phaser from "phaser";
import { CellAnimation, type Direction } from "./cellAnimation";
import { bindCellTexture } from "./cellActor";
import restingCharacterMetadata from "../../../../slime-assets/assets/sprites/characters/default/rest-v2/rest-v2.animation.json";
import characterIdleSourceMetadata from "../../../../slime-assets/assets/sprites/characters/default/idle-v6/source.json";
import actorIdleMetadata0 from "../../../../slime-assets/assets/sprites/characters/default/idle-v6/idle-v6.animation.json";
import actorIdleMetadata1 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/slime-idle-v1.animation.json";
import actorIdleMetadata2 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/beast-idle-v2.animation.json";
import actorIdleMetadata3 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/giant-idle-v1.animation.json";
import actorIdleMetadata4 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/field-rabbit-idle-v1.animation.json";
import actorIdleMetadata5 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/stone-crab-idle-v1.animation.json";
import actorIdleMetadata6 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/ridge-boar-idle-v1.animation.json";
import actorIdleMetadata7 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/lantern-moth-idle-v1.animation.json";
import actorIdleMetadata8 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/reed-crawler-idle-v1.animation.json";
import actorIdleMetadata9 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/ash-fox-idle-v1.animation.json";
import actorIdleMetadata10 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/crystal-lizard-idle-v1.animation.json";

const DEFAULT_IDLE_ANIMATION = new CellAnimation(actorIdleMetadata0);
const DEFAULT_CHARACTER_IDLE_ASSET = {
  key: "idle-human", url: new URL("../../../../slime-assets/assets/sprites/characters/default/idle-v6/idle-v6.png", import.meta.url).href,
  animation: DEFAULT_IDLE_ANIMATION,
} as const;
export const DEFAULT_IDLE_DIRECTION_ASSETS = {
  down_left: DEFAULT_CHARACTER_IDLE_ASSET,
  down_right: DEFAULT_CHARACTER_IDLE_ASSET,
  up_left: DEFAULT_CHARACTER_IDLE_ASSET,
  up_right: DEFAULT_CHARACTER_IDLE_ASSET,
} as const;

export const ACTOR_IDLE_ASSETS = {
  "human-rest": { key: "resting-human", url: new URL("../../../../slime-assets/assets/sprites/characters/default/rest-v2/rest-v2.png", import.meta.url).href, animation: new CellAnimation(restingCharacterMetadata) },
  "human": DEFAULT_IDLE_DIRECTION_ASSETS.down_left,
  "slime": { key: "idle-slime", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/slime-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata1) },
  "beast": { key: "idle-beast", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/beast-idle-v2.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata2) },
  "giant": { key: "idle-giant", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/giant-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata3) },
  "field-rabbit": { key: "idle-field-rabbit", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/field-rabbit-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata4) },
  "stone-crab": { key: "idle-stone-crab", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/stone-crab-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata5) },
  "ridge-boar": { key: "idle-ridge-boar", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/ridge-boar-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata6) },
  "lantern-moth": { key: "idle-lantern-moth", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/lantern-moth-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata7) },
  "reed-crawler": { key: "idle-reed-crawler", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/reed-crawler-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata8) },
  "ash-fox": { key: "idle-ash-fox", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/ash-fox-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata9) },
  "crystal-lizard": { key: "idle-crystal-lizard", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/crystal-lizard-idle-v1.png", import.meta.url).href, animation: new CellAnimation(actorIdleMetadata10) },
} as const;
export type IdleActorKind = keyof typeof ACTOR_IDLE_ASSETS;
const IDLE_BODY_HEIGHT_RATIO = 0.75;
const DEFAULT_IDLE_BODY_HEIGHT = characterIdleSourceMetadata.referenceBodyHeight;
if (!Number.isFinite(DEFAULT_IDLE_BODY_HEIGHT) || DEFAULT_IDLE_BODY_HEIGHT <= 0) throw new Error("기본 캐릭터 기준 높이가 올바르지 않습니다.");
export const ACTOR_IDLE_TEXTURES = Object.values(ACTOR_IDLE_ASSETS);
export function resolveActorIdleAsset(actorIdleKind: IdleActorKind, actorScreenDirection: Direction) {
  const selectedIdleAsset = actorIdleKind === "human" ? DEFAULT_IDLE_DIRECTION_ASSETS[actorScreenDirection] : ACTOR_IDLE_ASSETS[actorIdleKind];
  if (!selectedIdleAsset) throw new Error("등록되지 않은 대기 개체 또는 방향입니다.");
  return selectedIdleAsset;
}

export function updateActorIdleFrame(actorRenderImage: Phaser.GameObjects.Image, actorScreenDirection: Direction, actionElapsedMilliseconds?: number) {
  const actorIdleKind = actorRenderImage.getData("actorIdleKind") as IdleActorKind;
  const actorIdleAsset = resolveActorIdleAsset(actorIdleKind, actorScreenDirection);
  if (!actorIdleAsset) throw new Error("등록되지 않은 대기 개체입니다.");
  const actorIdleAnimation = actorIdleAsset.animation;
  const sampledIdleFrame = actorIdleAnimation.sample(actorIdleAnimation.clip("idle", actorScreenDirection), actionElapsedMilliseconds ?? (actorRenderImage.scene.time.now + actorRenderImage.getData("idlePhaseOffset"))).frame;
  const selectedIdleFrame = `cell:${actorIdleAnimation.data.animationId}@${actorIdleAnimation.data.version}:${sampledIdleFrame.frameId}`;
  const selectedFrameOriginX = sampledIdleFrame.anchor.x / sampledIdleFrame.rect.width;
  const selectedFrameOriginY = sampledIdleFrame.anchor.y / sampledIdleFrame.rect.height;
  if (actorRenderImage.frame.name !== selectedIdleFrame)
    actorRenderImage.setTexture(actorIdleAsset.key, selectedIdleFrame);
  if (actorRenderImage.originX !== selectedFrameOriginX || actorRenderImage.originY !== selectedFrameOriginY)
    actorRenderImage.setOrigin(selectedFrameOriginX, selectedFrameOriginY);
}

export function createActorIdleImage(actorRenderScene: Phaser.Scene, actorIdleKind: IdleActorKind,
  actorWorldPosition: {x:number;y:number}, actorDisplayHeight: number, actorScreenDirection: Direction, actorStableIdentifier: string) {
  const actorIdleAsset = resolveActorIdleAsset(actorIdleKind, actorScreenDirection);
  const requiredIdleTextures = [actorIdleAsset];
  for (const currentIdleTexture of requiredIdleTextures) bindCellTexture(actorRenderScene, currentIdleTexture.key, currentIdleTexture.animation);
  const idleCycleDuration = actorIdleAsset.animation.data.clips.find(idleClipRecord => idleClipRecord.direction === actorScreenDirection && idleClipRecord.action === "idle")!
    .frames.reduce((totalFrameDuration, idleFrameRecord) => totalFrameDuration + idleFrameRecord.durationMs, 0);
  const idlePhaseOffset = calculateIdlePhase(actorStableIdentifier, idleCycleDuration);
  const initialIdleFrame = actorIdleAsset.animation.data.frames[0];
  const actorRenderImage = actorRenderScene.add.image(actorWorldPosition.x, actorWorldPosition.y, actorIdleAsset.key)
    .setScale(actorDisplayHeight / (actorIdleKind === "human" ? DEFAULT_IDLE_BODY_HEIGHT : initialIdleFrame.rect.height * IDLE_BODY_HEIGHT_RATIO))
    .setData("actorDisplayHeight", actorDisplayHeight).setData("idlePhaseOffset", idlePhaseOffset).setData("actorIdleKind", actorIdleKind).setData("characterRestingFacing", actorScreenDirection);
  updateActorIdleFrame(actorRenderImage, actorScreenDirection);
  return actorRenderImage;
}

// 스트레칭 에셋 채택 전에는 현재 대기 한 주기를 대신 재생한다.
export function calculateFieldIdleDuration(actorScreenDirection: Direction): number {
  const selectedIdleClip = DEFAULT_IDLE_ANIMATION.data.clips.find(clipRecordValue => clipRecordValue.action === "idle" && clipRecordValue.direction === actorScreenDirection)!;
  return selectedIdleClip.frames.reduce((totalDurationValue, frameRecordValue) => totalDurationValue + frameRecordValue.durationMs, 0);
}
