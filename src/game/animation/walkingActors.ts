import {CHARACTER_MOVEMENT_SPEED_MULTIPLIER} from '../terrain/movementTransition';
import { parseDocument } from 'yaml';
import { resolveCharacterBodyHeight } from './characterBodyHeight';
import walkingCharacterSource from '../../../../slime-assets/assets/characters/default/animations/light-leather/walk/source.yaml?raw';
import { createBoardActorAnimation } from './boardAnimation';
import type Phaser from "phaser";
import { type Direction } from "./cellAnimation";
import { bindCellTexture } from "./cellActor";
import { updateActorIdleFrame } from "./idleActors";
import walkingCharacterMetadata from "../../../../slime-assets/assets/characters/default/animations/light-leather/walk/walk-light-leather-v1.animation.json";

const walkingSourceDocument = parseDocument(walkingCharacterSource, { uniqueKeys: true });
if (walkingSourceDocument.errors.length) throw new Error('걷기 에셋 출처 YAML이 올바르지 않습니다.');
const WALKING_REFERENCE_BODY_HEIGHT = resolveCharacterBodyHeight(walkingSourceDocument.toJS(), walkingCharacterMetadata);
export const DEFAULT_CHARACTER_WALK_ASSET = {
  key: "walking-human-light-leather-v1",
  url: new URL("../../../../slime-assets/assets/characters/default/animations/light-leather/walk/walk-v2.png", import.meta.url).href,
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
    characterWalkAsset.animation.clip("walk", "down_right"), movementElapsedMilliseconds! * CHARACTER_MOVEMENT_SPEED_MULTIPLIER).frame;
  actorRenderImage.setTexture(characterWalkAsset.key,
    `cell:${characterWalkAsset.animation.data.animationId}@${characterWalkAsset.animation.data.version}:${sampledWalkingFrame.frameId}`)
    .setOrigin(sampledWalkingFrame.anchor.x / sampledWalkingFrame.rect.width, sampledWalkingFrame.anchor.y / sampledWalkingFrame.rect.height)
    .setScale(actorRenderImage.getData("actorDisplayHeight") / WALKING_REFERENCE_BODY_HEIGHT);
}
