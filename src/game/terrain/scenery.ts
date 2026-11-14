import type Phaser from "phaser";
import sceneryAssetSources from "./scenery.asset-list.yaml";

/** 등록된 지형지물 원본을 게임 텍스처로 준비한다. */
export function preloadFieldScenery(currentGameScene: Phaser.Scene) {
  for (const [currentAssetIdentifier, currentAssetSource] of Object.entries(sceneryAssetSources)) {
    currentGameScene.load.image(currentAssetIdentifier.replaceAll("_", "-"), currentAssetSource);
  }
}
