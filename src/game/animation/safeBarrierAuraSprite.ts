import Phaser from "phaser";

export const SAFE_BARRIER_AURA_SPRITE_CONTRACT = Object.freeze({ frameWidthPixels: 64, frameHeightPixels: 64, frameColumnCount: 4, frameRowCount: 2, frameTotalCount: 8, displayHeightPixels: 25 });
const SAFE_BARRIER_AURA_TEXTURE_KEY = "safe-barrier-aura";
const SAFE_BARRIER_AURA_SOURCE_URL = new URL("../../../../slime-assets/assets/sprites/effects/safe-barrier/safe-barrier-aura-v1-source.png", import.meta.url).href;
const SAFE_BARRIER_AURA_SOURCE_WIDTH = 1774;
const SAFE_BARRIER_AURA_SOURCE_HEIGHT = 887;
const SAFE_BARRIER_AURA_COLUMN_BOUNDARIES = [0, 444, 887, 1331, SAFE_BARRIER_AURA_SOURCE_WIDTH];
const SAFE_BARRIER_AURA_ROW_BOUNDARIES = [0, 444, SAFE_BARRIER_AURA_SOURCE_HEIGHT];
const SAFE_BARRIER_AURA_FRAME_DURATION_MILLISECONDS = 120;
const SAFE_BARRIER_AURA_FRAME_HORIZONTAL_CROP_RATIO = 0.2;
type ScreenPoint = { x: number; y: number };

export function preloadSafeBarrierAuraSprite(scene: Phaser.Scene) {
  scene.load.image(SAFE_BARRIER_AURA_TEXTURE_KEY, SAFE_BARRIER_AURA_SOURCE_URL);
}

function getAuraFrameUvs(currentFrameIndex: number) {
  const currentColumnIndex = currentFrameIndex % SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameColumnCount;
  const currentRowIndex = Math.floor(currentFrameIndex / SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameColumnCount);
  const frameLeftPixels = SAFE_BARRIER_AURA_COLUMN_BOUNDARIES[currentColumnIndex];
  const frameTopPixels = SAFE_BARRIER_AURA_ROW_BOUNDARIES[currentRowIndex];
  const frameRightPixels = SAFE_BARRIER_AURA_COLUMN_BOUNDARIES[currentColumnIndex + 1];
  const frameBottomPixels = SAFE_BARRIER_AURA_ROW_BOUNDARIES[currentRowIndex + 1];
  const frameWidthPixels = frameRightPixels - frameLeftPixels;
  const textureLeftPixels = frameLeftPixels + frameWidthPixels * SAFE_BARRIER_AURA_FRAME_HORIZONTAL_CROP_RATIO;
  const textureRightPixels = frameRightPixels - frameWidthPixels * SAFE_BARRIER_AURA_FRAME_HORIZONTAL_CROP_RATIO;
  return [
    textureLeftPixels / SAFE_BARRIER_AURA_SOURCE_WIDTH, frameBottomPixels / SAFE_BARRIER_AURA_SOURCE_HEIGHT,
    textureRightPixels / SAFE_BARRIER_AURA_SOURCE_WIDTH, frameBottomPixels / SAFE_BARRIER_AURA_SOURCE_HEIGHT,
    textureLeftPixels / SAFE_BARRIER_AURA_SOURCE_WIDTH, frameTopPixels / SAFE_BARRIER_AURA_SOURCE_HEIGHT,
    textureRightPixels / SAFE_BARRIER_AURA_SOURCE_WIDTH, frameTopPixels / SAFE_BARRIER_AURA_SOURCE_HEIGHT,
  ];
}

function applyAuraFrameUvs(auraMesh: Phaser.GameObjects.Mesh, currentFrameIndex: number) {
  const frameUvs = getAuraFrameUvs(currentFrameIndex);
  for (let currentVertexIndex = 0; currentVertexIndex < auraMesh.vertices.length; currentVertexIndex += 1) {
    auraMesh.vertices[currentVertexIndex].u = frameUvs[currentVertexIndex * 2];
    auraMesh.vertices[currentVertexIndex].v = frameUvs[currentVertexIndex * 2 + 1];
  }
}

/** 타일 엣지를 바닥선으로 고정하고, 위로 수직 25px을 세운 오러 벽면을 만든다. */
export function createSafeBarrierAuraSprite(scene: Phaser.Scene, boundaryStartPosition: ScreenPoint, boundaryEndPosition: ScreenPoint, boundaryDepth: number) {
  const boundaryCenterPosition = { x: (boundaryStartPosition.x + boundaryEndPosition.x) / 2, y: (boundaryStartPosition.y + boundaryEndPosition.y) / 2 };
  const boundaryStartOffset = { x: boundaryStartPosition.x - boundaryCenterPosition.x, y: boundaryStartPosition.y - boundaryCenterPosition.y };
  const boundaryEndOffset = { x: boundaryEndPosition.x - boundaryCenterPosition.x, y: boundaryEndPosition.y - boundaryCenterPosition.y };
  const boundaryWallHeightPixels = SAFE_BARRIER_AURA_SPRITE_CONTRACT.displayHeightPixels;
  const auraMesh = scene.add.mesh(boundaryCenterPosition.x, boundaryCenterPosition.y, SAFE_BARRIER_AURA_TEXTURE_KEY, undefined, [
    boundaryStartOffset.x, boundaryStartOffset.y,
    boundaryEndOffset.x, boundaryEndOffset.y,
    boundaryStartOffset.x, boundaryStartOffset.y - boundaryWallHeightPixels,
    boundaryEndOffset.x, boundaryEndOffset.y - boundaryWallHeightPixels,
  ], getAuraFrameUvs(0), [0, 2, 1, 2, 3, 1]);
  auraMesh.hideCCW = false;
  auraMesh.ignoreDirtyCache = true;
  auraMesh.setOrtho(SAFE_BARRIER_AURA_SOURCE_WIDTH, SAFE_BARRIER_AURA_SOURCE_HEIGHT);
  auraMesh.setDepth(boundaryDepth);
  const synchronizeAuraFrame = (currentTimeMilliseconds: number) => {
    const currentFrameIndex = Math.floor(currentTimeMilliseconds / SAFE_BARRIER_AURA_FRAME_DURATION_MILLISECONDS) % SAFE_BARRIER_AURA_SPRITE_CONTRACT.frameTotalCount;
    applyAuraFrameUvs(auraMesh, currentFrameIndex);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, synchronizeAuraFrame);
  auraMesh.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, synchronizeAuraFrame));
  return auraMesh;
}
