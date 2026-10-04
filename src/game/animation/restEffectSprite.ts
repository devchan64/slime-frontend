import Phaser from "phaser";
import { CellAnimation } from "./cellAnimation";
import { CellActor } from "./cellActor";
import { FIELD_REST_EFFECT_SPRITE_CONTRACT } from "./restEffectSpriteContract";

const REST_EFFECT_TEXTURE_KEY = "field-rest-recovery-effect";
const REST_EFFECT_SOURCE_URL = new URL("../../../../slime-assets/assets/sprites/effects/rest/rest-recovery-v1-source.png", import.meta.url).href;
const REST_EFFECT_SOURCE_DIMENSION_PIXELS = 1254;
const REST_EFFECT_FRAME_BOUNDARIES = [0, 314, 627, 941, REST_EFFECT_SOURCE_DIMENSION_PIXELS];
const REST_EFFECT_FRAME_DURATION_MILLISECONDS = 100;
const REST_EFFECT_ANIMATION_DATA = {
  animationId: "field.rest.recovery-effect",
  version: "source-v1",
  sheet: { width: REST_EFFECT_SOURCE_DIMENSION_PIXELS, height: REST_EFFECT_SOURCE_DIMENSION_PIXELS },
  frames: Array.from({ length: FIELD_REST_EFFECT_SPRITE_CONTRACT.frameTotalCount }, (_, currentFrameIndex) => {
    const currentColumnIndex = currentFrameIndex % FIELD_REST_EFFECT_SPRITE_CONTRACT.frameColumnCount;
    const currentRowIndex = Math.floor(currentFrameIndex / FIELD_REST_EFFECT_SPRITE_CONTRACT.frameColumnCount);
    const frameLeftPixels = REST_EFFECT_FRAME_BOUNDARIES[currentColumnIndex];
    const frameTopPixels = REST_EFFECT_FRAME_BOUNDARIES[currentRowIndex];
    const frameWidthPixels = REST_EFFECT_FRAME_BOUNDARIES[currentColumnIndex + 1] - frameLeftPixels;
    const frameHeightPixels = REST_EFFECT_FRAME_BOUNDARIES[currentRowIndex + 1] - frameTopPixels;
    return {
      frameId: `down_left.${currentFrameIndex}`,
      rect: { x: frameLeftPixels, y: frameTopPixels, width: frameWidthPixels, height: frameHeightPixels },
      anchor: { x: frameWidthPixels / 2, y: frameHeightPixels / 2 },
    };
  }),
  clips: [{
    clipId: "idle.down_left",
    action: "idle",
    direction: "down_left",
    frames: Array.from({ length: FIELD_REST_EFFECT_SPRITE_CONTRACT.frameTotalCount }, (_, currentFrameIndex) => ({
      frameId: `down_left.${currentFrameIndex}`,
      durationMs: REST_EFFECT_FRAME_DURATION_MILLISECONDS,
    })),
    loop: true,
    nextClipId: null,
  }],
} as const;
const REST_EFFECT_ANIMATION = new CellAnimation(REST_EFFECT_ANIMATION_DATA);
const REST_EFFECT_DISPLAY_SCALE = FIELD_REST_EFFECT_SPRITE_CONTRACT.frameWidthPixels / REST_EFFECT_FRAME_BOUNDARIES[1];
const REST_EFFECT_HEAD_OFFSET_PIXELS = 0;

export function preloadFieldRestEffectSprite(scene: Phaser.Scene) {
  scene.load.image(REST_EFFECT_TEXTURE_KEY, REST_EFFECT_SOURCE_URL);
}

export function createFieldRestEffectSprite(scene: Phaser.Scene, actorWorldPosition: { x: number; y: number }, actorDisplayHeight: number, actorDepth: number) {
  if (!Number.isFinite(actorDisplayHeight) || actorDisplayHeight <= 0) throw new Error("휴식 효과의 캐릭터 높이가 올바르지 않습니다.");
  const currentEffectActor = new CellActor(scene, REST_EFFECT_TEXTURE_KEY, REST_EFFECT_ANIMATION, {
    x: actorWorldPosition.x,
    y: actorWorldPosition.y - actorDisplayHeight - REST_EFFECT_HEAD_OFFSET_PIXELS,
    scale: REST_EFFECT_DISPLAY_SCALE,
    action: "idle",
    direction: "down_left",
  });
  currentEffectActor.image.setDepth(actorDepth);
  return currentEffectActor.image;
}
