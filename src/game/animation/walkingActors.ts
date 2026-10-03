import { createBoardActorAnimation } from './boardAnimation';
import type Phaser from "phaser";
import { type Direction } from "./cellAnimation";
import { bindCellTexture } from "./cellActor";
import { updateActorIdleFrame } from "./idleActors";
import walkingCharacterMetadata from "../../../../slime-assets/assets/characters/default/animations/walk-12frames-v1/down-left-12frames-v2/walk-12frames-v1.animation.json";

const WALKING_REFERENCE_BODY_HEIGHT = 360.0;
export const DEFAULT_CHARACTER_WALK_ASSET = {
  key: "walking-human-12frames-v1",
  url: new URL("../../../../slime-assets/assets/characters/default/animations/walk-12frames-v1/down-left-12frames-v2/walk-12frames-v1.png", import.meta.url).href,
  animation: createBoardActorAnimation(walkingCharacterMetadata),
} as const;

/** 이동 중 걷기를 표시하고 정지 시 원래 크기와 대기로 돌아간다. */
export function updateCharacterAnimationFrame(actorRenderImage: Phaser.GameObjects.Image,
  actorScreenDirection: Direction, actionElapsedMilliseconds?: number, movementElapsedMilliseconds?: number) {
  const characterWalkingActive = movementElapsedMilliseconds !== undefined && actorRenderImage.getData("actorIdleKind") === "human";
  if (!characterWalkingActive) {
    const savedIdleScaleValue = actorRenderImage.getData("walkingIdleScale");
    if (savedIdleScaleValue !== undefined) {
      actorRenderImage.setScale(savedIdleScaleValue).setData("walkingIdleScale", undefined);
    }
    updateActorIdleFrame(actorRenderImage, actorScreenDirection, actionElapsedMilliseconds);
    return;
  }
  const characterWalkAsset = DEFAULT_CHARACTER_WALK_ASSET;
  if (actorRenderImage.getData("walkingIdleScale") === undefined) {
    bindCellTexture(actorRenderImage.scene, characterWalkAsset.key, characterWalkAsset.animation);
    actorRenderImage.setData("walkingIdleScale", actorRenderImage.scaleX);
  }
  const sampledWalkingFrame = characterWalkAsset.animation.sample(
    characterWalkAsset.animation.clip("walk", actorScreenDirection), movementElapsedMilliseconds!).frame;
  actorRenderImage.setTexture(characterWalkAsset.key,
    `cell:${characterWalkAsset.animation.data.animationId}@${characterWalkAsset.animation.data.version}:${sampledWalkingFrame.frameId}`)
    .setOrigin(sampledWalkingFrame.anchor.x / sampledWalkingFrame.rect.width, sampledWalkingFrame.anchor.y / sampledWalkingFrame.rect.height)
    .setScale(actorRenderImage.getData("actorDisplayHeight") / WALKING_REFERENCE_BODY_HEIGHT);
}
