import type Phaser from "phaser";
import { CellAnimation, type Direction } from "./cellAnimation";
import { bindCellTexture } from "./cellActor";
import { updateActorIdleFrame } from "./idleActors";
import walkingCharacterMetadata from "../../assets/characters/default/walk-v2/walk-v2.animation.json";

const WALKING_REFERENCE_BODY_HEIGHT = 352;
export const DEFAULT_CHARACTER_WALK_ASSET = {
  key: "walking-human-v2",
  url: new URL("../../assets/characters/default/walk-v2/walk-v2.png", import.meta.url).href,
  animation: new CellAnimation(walkingCharacterMetadata),
} as const;

/** 이동 중 걷기를 표시하고 정지 시 원래 크기와 대기로 돌아간다. */
export function updateCharacterAnimationFrame(actorRenderImage: Phaser.GameObjects.Image,
  actorScreenDirection: Direction, actionElapsedMilliseconds?: number, characterMovementActive = false) {
  const characterWalkingActive = characterMovementActive && actorRenderImage.getData("actorIdleKind") === "human";
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
  // 180ms 단위의 짧은 이동에도 매번 첫 프레임으로 되돌아가지 않는다.
  const walkingElapsedMilliseconds = actorRenderImage.scene.time.now + actorRenderImage.getData("idlePhaseOffset");
  const sampledWalkingFrame = characterWalkAsset.animation.sample(
    characterWalkAsset.animation.clip("walk", actorScreenDirection), walkingElapsedMilliseconds).frame;
  actorRenderImage.setTexture(characterWalkAsset.key,
    `cell:${characterWalkAsset.animation.data.animationId}@${characterWalkAsset.animation.data.version}:${sampledWalkingFrame.frameId}`)
    .setOrigin(sampledWalkingFrame.anchor.x / sampledWalkingFrame.rect.width, sampledWalkingFrame.anchor.y / sampledWalkingFrame.rect.height)
    .setScale(actorRenderImage.getData("actorDisplayHeight") / WALKING_REFERENCE_BODY_HEIGHT);
}
