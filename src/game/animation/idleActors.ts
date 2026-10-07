import {attachCharacterOutlineLayers} from './characterOutline';
import newMonsterMetadata4 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/crystal-bat-idle-v1.animation.json";
import newMonsterMetadata3 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ember-hedgehog-idle-v1.animation.json";
import newMonsterMetadata2 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/sand-scorpion-idle-v1.animation.json";
import newMonsterMetadata1 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/mist-frog-idle-v1.animation.json";
import newMonsterMetadata0 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/moss-turtle-idle-v1.animation.json";
import { createBoardActorAnimation } from './boardAnimation';
import { calculateIdlePhase } from "./idlePhase";
import type Phaser from "phaser";
import { type Direction } from "./cellAnimation";
import { bindCellTexture } from "./cellActor";
import restingCharacterMetadata from "../../../../slime-assets/assets/characters/default/animations/rest-v2/down-left-entry-exit-v2/rest-v2.animation.json";
import characterRestSourceMetadata from "../../../../slime-assets/assets/characters/default/animations/rest-v2/down-left-entry-exit-v2/source.json";
import type { RestPlaybackSample } from "./fieldRestAnimation";
import characterIdleSourceMetadata from "../../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v2/source.json";
import actorIdleMetadata0 from "../../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v2/idle-v6-anchor-v3.animation.json";
import actorIdleMetadata1 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/slime-idle-v2.animation.json";
import actorIdleMetadata2 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/beast-idle-v2.animation.json";
import actorIdleMetadata3 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/giant-idle-v1.animation.json";
import actorIdleMetadata4 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/field-rabbit-idle-v1.animation.json";
import actorIdleMetadata5 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/stone-crab-idle-v1.animation.json";
import actorIdleMetadata6 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ridge-boar-idle-v1.animation.json";
import actorIdleMetadata7 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/lantern-moth-idle-v1.animation.json";
import actorIdleMetadata8 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/reed-crawler-idle-v1.animation.json";
import actorIdleMetadata9 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ash-fox-idle-v1.animation.json";
import actorIdleMetadata10 from "../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/crystal-lizard-idle-v1.animation.json";

const DEFAULT_IDLE_ANIMATION = createBoardActorAnimation(actorIdleMetadata0);
const DEFAULT_CHARACTER_IDLE_ASSET = {
  key: "idle-human", url: new URL("../../../../slime-assets/assets/characters/default/animations/idle-v6/down-left-8frames-v2/idle-v6.png", import.meta.url).href,
  animation: DEFAULT_IDLE_ANIMATION,
} as const;
export const DEFAULT_IDLE_DIRECTION_ASSETS = {
  down_left: DEFAULT_CHARACTER_IDLE_ASSET,
} as const;

export const ACTOR_IDLE_ASSETS = {
  "human-rest": { key: "resting-human", url: new URL("../../../../slime-assets/assets/characters/default/animations/rest-v2/down-left-entry-exit-v2/rest-v2.png", import.meta.url).href, animation: createBoardActorAnimation(restingCharacterMetadata) },
  "human": DEFAULT_IDLE_DIRECTION_ASSETS.down_left,
  "moss-turtle": { key: "idle-moss-turtle", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/moss-turtle-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(newMonsterMetadata0) },
  "mist-frog": { key: "idle-mist-frog", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/mist-frog-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(newMonsterMetadata1) },
  "sand-scorpion": { key: "idle-sand-scorpion", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/sand-scorpion-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(newMonsterMetadata2) },
  "ember-hedgehog": { key: "idle-ember-hedgehog", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ember-hedgehog-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(newMonsterMetadata3) },
  "crystal-bat": { key: "idle-crystal-bat", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/crystal-bat-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(newMonsterMetadata4) },
  "slime": { key: "idle-slime", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/slime-idle-v2.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata1) },
  "beast": { key: "idle-beast", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/beast-idle-v2.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata2) },
  "giant": { key: "idle-giant", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/giant-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata3) },
  "field-rabbit": { key: "idle-field-rabbit", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/field-rabbit-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata4) },
  "stone-crab": { key: "idle-stone-crab", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/stone-crab-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata5) },
  "ridge-boar": { key: "idle-ridge-boar", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ridge-boar-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata6) },
  "lantern-moth": { key: "idle-lantern-moth", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/lantern-moth-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata7) },
  "reed-crawler": { key: "idle-reed-crawler", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/reed-crawler-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata8) },
  "ash-fox": { key: "idle-ash-fox", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/ash-fox-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata9) },
  "crystal-lizard": { key: "idle-crystal-lizard", url: new URL("../../../../slime-assets/assets/sprites/monsters/standing-v1/down-left-v1/crystal-lizard-idle-v1.png", import.meta.url).href, animation: createBoardActorAnimation(actorIdleMetadata10) },
} as const;
export type IdleActorKind = keyof typeof ACTOR_IDLE_ASSETS;
const IDLE_BODY_HEIGHT_RATIO = 0.75;
const REST_REFERENCE_BODY_HEIGHT = characterRestSourceMetadata.referenceBodyHeight;
const DEFAULT_IDLE_BODY_HEIGHT = characterIdleSourceMetadata.referenceBodyHeight;
if (!Number.isFinite(DEFAULT_IDLE_BODY_HEIGHT) || DEFAULT_IDLE_BODY_HEIGHT <= 0) throw new Error("기본 캐릭터 기준 높이가 올바르지 않습니다.");
export const ACTOR_IDLE_TEXTURES = Object.values(ACTOR_IDLE_ASSETS);
export function resolveActorIdleAsset(actorIdleKind: IdleActorKind, actorScreenDirection: Direction) {
  if (actorScreenDirection !== "down_left") throw new Error("정면왼쪽 클립만 지원합니다.");
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
    .setScale(actorDisplayHeight / (actorIdleKind === "human" ? DEFAULT_IDLE_BODY_HEIGHT : actorIdleKind === "human-rest" ? REST_REFERENCE_BODY_HEIGHT : initialIdleFrame.rect.height * IDLE_BODY_HEIGHT_RATIO))
    .setData("actorDisplayHeight", actorDisplayHeight).setData("idlePhaseOffset", idlePhaseOffset).setData("actorIdleKind", actorIdleKind).setData("characterRestingFacing", actorScreenDirection);
  updateActorIdleFrame(actorRenderImage, actorScreenDirection);
  if (actorIdleKind === 'human' || actorIdleKind === 'human-rest') attachCharacterOutlineLayers(actorRenderImage);
  return actorRenderImage;
}

// 스트레칭 에셋 채택 전에는 현재 대기 한 주기를 대신 재생한다.
export function calculateFieldIdleDuration(actorScreenDirection: Direction): number {
  const selectedIdleClip = DEFAULT_IDLE_ANIMATION.data.clips.find(clipRecordValue => clipRecordValue.action === "idle" && clipRecordValue.direction === actorScreenDirection)!;
  return selectedIdleClip.frames.reduce((totalDurationValue, frameRecordValue) => totalDurationValue + frameRecordValue.durationMs, 0);
}

/** 비반복 해제 클립의 실제 재생 시간. */
export function calculateRestExitDuration(): number {
  return ACTOR_IDLE_ASSETS['human-rest'].animation.data.clips.find(currentClipRecord => currentClipRecord.action === 'rest-exit')!
    .frames.reduce((totalDurationValue, currentFrameRecord) => totalDurationValue + currentFrameRecord.durationMs, 0);
}

/** 앉은 마지막 프레임을 고정하고, 해제 종료 뒤에는 기존 대기 재생으로 돌린다. */
export function updateActorRestPlayback(actorRenderImage: Phaser.GameObjects.Image, actorScreenDirection: Direction, restPlaybackSample: RestPlaybackSample | null): boolean {
  if (!restPlaybackSample) {
    if (actorRenderImage.getData('restPlaybackActive')) {
      actorRenderImage.setData('restPlaybackActive', false).setData('actorIdleKind', 'human');
      actorRenderImage.setScale(actorRenderImage.getData('actorDisplayHeight') / DEFAULT_IDLE_BODY_HEIGHT);
    }
    return false;
  }
  const restingActorAsset = ACTOR_IDLE_ASSETS['human-rest'];
  bindCellTexture(actorRenderImage.scene, restingActorAsset.key, restingActorAsset.animation);
  const sampledRestFrame = restingActorAsset.animation.sample(
    restingActorAsset.animation.clip(restPlaybackSample.actionNameValue, actorScreenDirection), restPlaybackSample.elapsedTimeValue).frame;
  actorRenderImage.setData('restPlaybackActive', true).setData('walkingIdleScale', undefined);
  actorRenderImage.setTexture(restingActorAsset.key, `cell:${restingActorAsset.animation.data.animationId}@${restingActorAsset.animation.data.version}:${sampledRestFrame.frameId}`)
    .setOrigin(sampledRestFrame.anchor.x / sampledRestFrame.rect.width, sampledRestFrame.anchor.y / sampledRestFrame.rect.height)
    .setScale(actorRenderImage.getData('actorDisplayHeight') / REST_REFERENCE_BODY_HEIGHT);
  return true;
}
