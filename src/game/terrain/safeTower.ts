import Phaser from "phaser";

const SAFE_TOWER_TEXTURE = {
  key: "structure-ward-tower-v1",
  url: new URL("../../../../slime-assets/assets/sprites/structures/ward-tower-v1.png", import.meta.url).href,
};
export function preloadSafeTower(currentGameScene: Phaser.Scene) {
  currentGameScene.load.image(SAFE_TOWER_TEXTURE.key, SAFE_TOWER_TEXTURE.url);
}
