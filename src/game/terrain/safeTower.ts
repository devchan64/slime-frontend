import Phaser from "phaser";
import {drawFieldTowerObject} from '../../../packages/field-renderer/field-renderer.mjs';

const SAFE_TOWER_TEXTURE = {
  key: "structure-ward-tower-v1",
  url: new URL("../../../../slime-assets/assets/sprites/structures/ward-tower-v1.png", import.meta.url).href,
};
export function preloadSafeTower(currentGameScene: Phaser.Scene) {
  currentGameScene.load.image(SAFE_TOWER_TEXTURE.key, SAFE_TOWER_TEXTURE.url);
}

/** 원본 받침부 중심을 안전지대 중앙 타일에 맞춘다. 통행 규칙은 변경하지 않는다. */
export function drawSafeTower(currentGameScene: Phaser.Scene, towerScreenPosition: {x: number; y: number}) {
  return drawFieldTowerObject(currentGameScene,towerScreenPosition,SAFE_TOWER_TEXTURE.key);
}
