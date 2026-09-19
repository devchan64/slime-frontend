import Phaser from "phaser";

const SAFE_TOWER_STYLE = {
  towerHalfWidth: 10, towerBodyHeight: 27, towerRoofHeight: 12,
  towerStoneColor: 0x9eaeae, towerShadowColor: 0x526b72,
  towerRoofColor: 0x426b75, barrierGlowColor: 0x90ebd9,
  baseRingWidth: 46, baseRingHeight: 22, beaconGlowRadius: 5,
  towerOffsetLeft: -12, towerOffsetUp: -7, barrierLineWidth: 2,
};

/** 결계 중심의 작은 탑을 타일 배율에 맞춰 표시한다. */
export function drawSafeTower(currentGameScene: Phaser.Scene, towerScreenPosition: {x: number; y: number}) {
  const towerDrawingStyle = SAFE_TOWER_STYLE;
  const towerGraphicsObject = currentGameScene.add.graphics({x: towerScreenPosition.x, y: towerScreenPosition.y});
  towerGraphicsObject.lineStyle(towerDrawingStyle.barrierLineWidth, towerDrawingStyle.barrierGlowColor, 0.8);
  towerGraphicsObject.strokeEllipse(0, 0, towerDrawingStyle.baseRingWidth, towerDrawingStyle.baseRingHeight);
  const towerBaseLeft = towerDrawingStyle.towerOffsetLeft - towerDrawingStyle.towerHalfWidth;
  const towerBaseHeight = towerDrawingStyle.towerOffsetUp;
  const towerRoofBase = towerBaseHeight - towerDrawingStyle.towerBodyHeight;
  towerGraphicsObject.fillStyle(towerDrawingStyle.towerStoneColor);
  towerGraphicsObject.fillRect(towerBaseLeft, towerRoofBase, towerDrawingStyle.towerHalfWidth * 2, towerDrawingStyle.towerBodyHeight);
  towerGraphicsObject.fillStyle(towerDrawingStyle.towerShadowColor);
  towerGraphicsObject.fillRect(towerDrawingStyle.towerOffsetLeft, towerRoofBase, towerDrawingStyle.towerHalfWidth, towerDrawingStyle.towerBodyHeight);
  towerGraphicsObject.fillStyle(towerDrawingStyle.towerRoofColor);
  towerGraphicsObject.fillTriangle(towerBaseLeft, towerRoofBase, towerBaseLeft + towerDrawingStyle.towerHalfWidth * 2, towerRoofBase,
    towerDrawingStyle.towerOffsetLeft, towerRoofBase - towerDrawingStyle.towerRoofHeight);
  towerGraphicsObject.fillStyle(towerDrawingStyle.barrierGlowColor);
  towerGraphicsObject.fillCircle(towerDrawingStyle.towerOffsetLeft, towerRoofBase - towerDrawingStyle.towerRoofHeight, towerDrawingStyle.beaconGlowRadius);
  return towerGraphicsObject;
}
