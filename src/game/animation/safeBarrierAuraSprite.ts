import Phaser from "phaser";
import { CellAnimation } from "./cellAnimation";
import { CellActor } from "./cellActor";

export const SAFE_BARRIER_AURA_SPRITE_CONTRACT = Object.freeze({ frameWidthPixels: 64, frameHeightPixels: 64, frameColumnCount: 4, frameRowCount: 2, frameTotalCount: 8, displayHeightPixels: 25 });
const SAFE_BARRIER_AURA_TEXTURE_KEY = "safe-barrier-aura";
const SAFE_BARRIER_AURA_SOURCE_URL = new URL("../../../../slime-assets/assets/sprites/effects/safe-barrier/safe-barrier-aura-v1-source.png", import.meta.url).href;
const SAFE_BARRIER_AURA_SOURCE_WIDTH = 1774, SAFE_BARRIER_AURA_SOURCE_HEIGHT = 887;
const SAFE_BARRIER_AURA_COLUMN_BOUNDARIES = [0, 444, 887, 1331, SAFE_BARRIER_AURA_SOURCE_WIDTH];
const SAFE_BARRIER_AURA_ROW_BOUNDARIES = [0, 444, SAFE_BARRIER_AURA_SOURCE_HEIGHT];
const SAFE_BARRIER_AURA_FRAME_DURATION_MILLISECONDS = 120;
const SAFE_BARRIER_AURA_ANIMATION_DATA = {
  animationId: "field.safe-barrier.aura", version: "source-v1", sheet: { width: SAFE_BARRIER_AURA_SOURCE_WIDTH, height: SAFE_BARRIER_AURA_SOURCE_HEIGHT },
  frames: Array.from({ length: SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameTotalCount }, (_, currentFrameIndex) => {
    const currentColumnIndex = currentFrameIndex % SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameColumnCount, currentRowIndex = Math.floor(currentFrameIndex / SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameColumnCount);
    const frameLeftPixels = SAFE_BARRIER_AURA_COLUMN_BOUNDARIES[currentColumnIndex], frameTopPixels = SAFE_BARRIER_AURA_ROW_BOUNDARIES[currentRowIndex];
    const frameWidthPixels = SAFE_BARRIER_AURA_COLUMN_BOUNDARIES[currentColumnIndex + 1] - frameLeftPixels, frameHeightPixels = SAFE_BARRIER_AURA_ROW_BOUNDARIES[currentRowIndex + 1] - frameTopPixels;
    return { frameId: `down_left.${currentFrameIndex}`, rect: { x: frameLeftPixels, y: frameTopPixels, width: frameWidthPixels, height: frameHeightPixels }, anchor: { x: frameWidthPixels / 2, y: frameHeightPixels } };
  }),
  clips: [{ clipId: "idle.down_left", action: "idle", direction: "down_left", loop: true, nextClipId: null, frames: Array.from({ length: SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameTotalCount }, (_, currentFrameIndex) => ({ frameId: `down_left.${currentFrameIndex}`, durationMs: SAFE_BARRIER_AURA_FRAME_DURATION_MILLISECONDS })) }],
} as const;
const SAFE_BARRIER_AURA_ANIMATION = new CellAnimation(SAFE_BARRIER_AURA_ANIMATION_DATA);

export function preloadSafeBarrierAuraSprite(scene: Phaser.Scene) { scene.load.image(SAFE_BARRIER_AURA_TEXTURE_KEY, SAFE_BARRIER_AURA_SOURCE_URL); }
export function createSafeBarrierAuraSprite(scene: Phaser.Scene, boundaryCenterPosition: { x: number; y: number }, boundaryWidthPixels: number, boundaryAngleRadians: number, boundaryDepth: number) {
  const currentAuraActor = new CellActor(scene, SAFE_BARRIER_AURA_TEXTURE_KEY, SAFE_BARRIER_AURA_ANIMATION, { x: boundaryCenterPosition.x, y: boundaryCenterPosition.y, scale: SAFE_BARRIER_AURA_SPRITE_CONTRACT.displayHeightPixels / SAFE_BARRIER_AURA_ROW_BOUNDARIES[1], action: "idle", direction: "down_left" });
  currentAuraActor.image.setDisplaySize(boundaryWidthPixels, SAFE_BARRIER_AURA_SPRITE_CONTRACT.displayHeightPixels).setRotation(boundaryAngleRadians).setDepth(boundaryDepth);
  return currentAuraActor.image;
}
