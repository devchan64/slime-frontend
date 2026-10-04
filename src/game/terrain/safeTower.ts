import Phaser from "phaser";

const SAFE_TOWER_TEXTURE = {
  key: "structure-ward-tower-v1",
  url: new URL("../../../../slime-assets/assets/sprites/structures/ward-tower-v1.png", import.meta.url).href,
  anchorX: 627, anchorY: 1095, bodyTop: 82, displayHeight: 112,
};
export function preloadSafeTower(currentGameScene: Phaser.Scene) {
  currentGameScene.load.image(SAFE_TOWER_TEXTURE.key, SAFE_TOWER_TEXTURE.url);
}

/** 원본 받침부 중심을 안전지대 중앙 타일에 맞춘다. 통행 규칙은 변경하지 않는다. */
export function drawSafeTower(currentGameScene: Phaser.Scene, towerScreenPosition: {x: number; y: number}) {
  if (!currentGameScene.textures.exists(SAFE_TOWER_TEXTURE.key)) throw new Error("결계탑 이미지가 로드되지 않았습니다.");
  const towerRenderImage = currentGameScene.add.image(0, 0, SAFE_TOWER_TEXTURE.key);
  towerRenderImage.setOrigin(SAFE_TOWER_TEXTURE.anchorX / towerRenderImage.width, SAFE_TOWER_TEXTURE.anchorY / towerRenderImage.height)
    .setScale(SAFE_TOWER_TEXTURE.displayHeight / (SAFE_TOWER_TEXTURE.anchorY - SAFE_TOWER_TEXTURE.bodyTop));
  return currentGameScene.add.container(towerScreenPosition.x, towerScreenPosition.y, [towerRenderImage]);
}
