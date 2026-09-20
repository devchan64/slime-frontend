import { calculateStandingPhase } from "./standingPhase";
import type Phaser from "phaser";
import { CellAnimation, type Direction } from "./cellAnimation";
import { bindCellTexture } from "./cellActor";
import standingMetadata0 from "../../assets/characters/character-default-white-shirt-standing-v2/idle-v2.animation.json";
import standingMetadata1 from "../../assets/monsters/standing-v1/slime-idle-v1.animation.json";
import standingMetadata2 from "../../assets/monsters/standing-v1/beast-idle-v2.animation.json";
import standingMetadata3 from "../../assets/monsters/standing-v1/giant-idle-v1.animation.json";
import standingMetadata4 from "../../assets/monsters/standing-v1/field-rabbit-idle-v1.animation.json";
import standingMetadata5 from "../../assets/monsters/standing-v1/stone-crab-idle-v1.animation.json";
import standingMetadata6 from "../../assets/monsters/standing-v1/ridge-boar-idle-v1.animation.json";
import standingMetadata7 from "../../assets/monsters/standing-v1/lantern-moth-idle-v1.animation.json";
import standingMetadata8 from "../../assets/monsters/standing-v1/reed-crawler-idle-v1.animation.json";
import standingMetadata9 from "../../assets/monsters/standing-v1/ash-fox-idle-v1.animation.json";
import standingMetadata10 from "../../assets/monsters/standing-v1/crystal-lizard-idle-v1.animation.json";

export const ACTOR_STANDING_ASSETS = {
  "human": { key: "standing-human", url: new URL("../../assets/characters/character-default-white-shirt-standing-v2/idle-v2.png", import.meta.url).href, animation: new CellAnimation(standingMetadata0) },
  "slime": { key: "standing-slime", url: new URL("../../assets/monsters/standing-v1/slime-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata1) },
  "beast": { key: "standing-beast", url: new URL("../../assets/monsters/standing-v1/beast-idle-v2.png", import.meta.url).href, animation: new CellAnimation(standingMetadata2) },
  "giant": { key: "standing-giant", url: new URL("../../assets/monsters/standing-v1/giant-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata3) },
  "field-rabbit": { key: "standing-field-rabbit", url: new URL("../../assets/monsters/standing-v1/field-rabbit-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata4) },
  "stone-crab": { key: "standing-stone-crab", url: new URL("../../assets/monsters/standing-v1/stone-crab-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata5) },
  "ridge-boar": { key: "standing-ridge-boar", url: new URL("../../assets/monsters/standing-v1/ridge-boar-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata6) },
  "lantern-moth": { key: "standing-lantern-moth", url: new URL("../../assets/monsters/standing-v1/lantern-moth-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata7) },
  "reed-crawler": { key: "standing-reed-crawler", url: new URL("../../assets/monsters/standing-v1/reed-crawler-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata8) },
  "ash-fox": { key: "standing-ash-fox", url: new URL("../../assets/monsters/standing-v1/ash-fox-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata9) },
  "crystal-lizard": { key: "standing-crystal-lizard", url: new URL("../../assets/monsters/standing-v1/crystal-lizard-idle-v1.png", import.meta.url).href, animation: new CellAnimation(standingMetadata10) },
} as const;
export type StandingActorKind = keyof typeof ACTOR_STANDING_ASSETS;
const STANDING_BODY_HEIGHT_RATIO = 0.75;

export function updateActorStandingFrame(actorRenderImage: Phaser.GameObjects.Image, actorScreenDirection: Direction) {
  const actorStandingKind = actorRenderImage.getData("actorStandingKind") as StandingActorKind;
  const actorStandingAsset = ACTOR_STANDING_ASSETS[actorStandingKind];
  if (!actorStandingAsset) throw new Error("등록되지 않은 스탠딩 개체입니다.");
  const actorStandingAnimation = actorStandingAsset.animation;
  const sampledStandingFrame = actorStandingAnimation.sample(actorStandingAnimation.clip("idle", actorScreenDirection), actorRenderImage.scene.time.now + actorRenderImage.getData("standingPhaseOffset")).frame;
  const selectedStandingFrame = `cell:${actorStandingAnimation.data.animationId}@${actorStandingAnimation.data.version}:${sampledStandingFrame.frameId}`;
  const selectedFrameOriginX = sampledStandingFrame.anchor.x / sampledStandingFrame.rect.width;
  const selectedFrameOriginY = sampledStandingFrame.anchor.y / sampledStandingFrame.rect.height;
  if (actorRenderImage.frame.name !== selectedStandingFrame)
    actorRenderImage.setTexture(actorStandingAsset.key, selectedStandingFrame);
  if (actorRenderImage.originX !== selectedFrameOriginX || actorRenderImage.originY !== selectedFrameOriginY)
    actorRenderImage.setOrigin(selectedFrameOriginX, selectedFrameOriginY);
}

export function createActorStandingImage(actorRenderScene: Phaser.Scene, actorStandingKind: StandingActorKind,
  actorWorldPosition: {x:number;y:number}, actorDisplayHeight: number, actorScreenDirection: Direction, actorStableIdentifier: string) {
  const actorStandingAsset = ACTOR_STANDING_ASSETS[actorStandingKind];
  bindCellTexture(actorRenderScene, actorStandingAsset.key, actorStandingAsset.animation);
  const standingCycleDuration = actorStandingAsset.animation.data.clips.find(standingClipRecord => standingClipRecord.direction === actorScreenDirection && standingClipRecord.action === "idle")!
    .frames.reduce((totalFrameDuration, standingFrameRecord) => totalFrameDuration + standingFrameRecord.durationMs, 0);
  const standingPhaseOffset = calculateStandingPhase(actorStableIdentifier, standingCycleDuration);
  const initialStandingFrame = actorStandingAsset.animation.data.frames[0];
  const actorRenderImage = actorRenderScene.add.image(actorWorldPosition.x, actorWorldPosition.y, actorStandingAsset.key)
    .setScale(actorDisplayHeight / (initialStandingFrame.rect.height * STANDING_BODY_HEIGHT_RATIO))
    .setData("standingPhaseOffset", standingPhaseOffset).setData("actorStandingKind", actorStandingKind).setData("characterRestingFacing", actorScreenDirection);
  updateActorStandingFrame(actorRenderImage, actorScreenDirection);
  return actorRenderImage;
}
