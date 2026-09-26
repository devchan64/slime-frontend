import Phaser from "phaser";

const SAFE_TOWER_TEXTURE = {
  key: "structure-ward-tower-v1",
  url: new URL("../../assets/structures/ward-tower-v1.png", import.meta.url).href,
  anchorX: 627, anchorY: 1095, bodyTop: 82, displayHeight: 112,
};
const SAFE_TOWER_GROUND = {
  ringWidth: 60, ringHeight: 29, lineWidth: 1,
  glowColor: 0x90ebd9, glowAlpha: 0.55,
  shadowColor: 0x18392e, shadowAlpha: 0.2, shadowWidth: 52, shadowHeight: 21,
};

export function preloadSafeTower(currentGameScene: Phaser.Scene) {
  currentGameScene.load.image(SAFE_TOWER_TEXTURE.key, SAFE_TOWER_TEXTURE.url);
}

/** 원본 받침부 중심을 안전지대 중앙 타일에 맞춘다. 통행 규칙은 변경하지 않는다. */
export function drawSafeTower(currentGameScene: Phaser.Scene, towerScreenPosition: {x: number; y: number}) {
  if (!currentGameScene.textures.exists(SAFE_TOWER_TEXTURE.key)) throw new Error("결계탑 이미지가 로드되지 않았습니다.");
  const towerGroundGraphics = currentGameScene.add.graphics();
  towerGroundGraphics.fillStyle(SAFE_TOWER_GROUND.shadowColor, SAFE_TOWER_GROUND.shadowAlpha);
  towerGroundGraphics.fillEllipse(0, 0, SAFE_TOWER_GROUND.shadowWidth, SAFE_TOWER_GROUND.shadowHeight);
  towerGroundGraphics.lineStyle(SAFE_TOWER_GROUND.lineWidth, SAFE_TOWER_GROUND.glowColor, SAFE_TOWER_GROUND.glowAlpha);
  towerGroundGraphics.strokeEllipse(0, 0, SAFE_TOWER_GROUND.ringWidth, SAFE_TOWER_GROUND.ringHeight);
  const towerRenderImage = currentGameScene.add.image(0, 0, SAFE_TOWER_TEXTURE.key);
  towerRenderImage.setOrigin(SAFE_TOWER_TEXTURE.anchorX / towerRenderImage.width, SAFE_TOWER_TEXTURE.anchorY / towerRenderImage.height)
    .setScale(SAFE_TOWER_TEXTURE.displayHeight / (SAFE_TOWER_TEXTURE.anchorY - SAFE_TOWER_TEXTURE.bodyTop));
  return currentGameScene.add.container(towerScreenPosition.x, towerScreenPosition.y, [towerGroundGraphics, towerRenderImage]);
}
