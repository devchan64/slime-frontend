import {CHARACTER_OUTLINE_DEPTH_STEP} from '../../../packages/field-renderer/render-constants.mjs';
export {CHARACTER_OUTLINE_DEPTH_STEP} from '../../../packages/field-renderer/render-constants.mjs';
import type Phaser from 'phaser';
import {CHARACTER_OUTLINE_BASE_WIDTH, CHARACTER_OUTLINE_BASE_COLOR, CHARACTER_SEPARATOR_BASE_WIDTH, CHARACTER_SEPARATOR_BASE_COLOR} from '../renderQuality';

const CHARACTER_OUTLINE_SAMPLE_OFFSETS = [[-1,0],[1,0],[0,-1],[0,1],[-0.707,-0.707],[0.707,-0.707],[-0.707,0.707],[0.707,0.707]];

/** 원본 프레임·앵커·좌우반전·이동을 따라가며 월드 단위 선폭을 유지한다. */
export function attachCharacterOutlineLayers(currentActorImage: Phaser.GameObjects.Image) {
  const currentActorScene = currentActorImage.scene;
  const currentOutlineLayers = [
    {color: CHARACTER_SEPARATOR_BASE_COLOR, radius: CHARACTER_OUTLINE_BASE_WIDTH + CHARACTER_SEPARATOR_BASE_WIDTH, depth: 2},
    {color: CHARACTER_OUTLINE_BASE_COLOR, radius: CHARACTER_OUTLINE_BASE_WIDTH, depth: 1},
  ].flatMap(currentLayerStyle => CHARACTER_OUTLINE_SAMPLE_OFFSETS.map(([currentOffsetHorizontal,currentOffsetVertical]) => ({
    image: currentActorScene.add.image(currentActorImage.x,currentActorImage.y,currentActorImage.texture.key,currentActorImage.frame.name)
      .setTintFill(currentLayerStyle.color).setData('characterOutlineLayer',true),
    horizontal: currentOffsetHorizontal * currentLayerStyle.radius,
    vertical: currentOffsetVertical * currentLayerStyle.radius,
    depth: currentLayerStyle.depth,
  })));
  const synchronizeCharacterOutlineLayers = () => {
    for (const currentOutlineLayer of currentOutlineLayers) {
      currentOutlineLayer.image.setTexture(currentActorImage.texture.key,currentActorImage.frame.name)
        .setOrigin(currentActorImage.originX,currentActorImage.originY)
        .setScale(currentActorImage.scaleX,currentActorImage.scaleY)
        .setFlip(currentActorImage.flipX,currentActorImage.flipY)
        .setRotation(currentActorImage.rotation)
        .setPosition(currentActorImage.x + currentOutlineLayer.horizontal,currentActorImage.y + currentOutlineLayer.vertical)
        .setDepth(currentActorImage.depth - currentOutlineLayer.depth * CHARACTER_OUTLINE_DEPTH_STEP)
        .setVisible(currentActorImage.visible).setAlpha(currentActorImage.alpha)
        .setScrollFactor(currentActorImage.scrollFactorX,currentActorImage.scrollFactorY);
    }
  };
  synchronizeCharacterOutlineLayers();
  currentActorScene.events.on('postupdate',synchronizeCharacterOutlineLayers);
  currentActorImage.once('destroy',() => {
    currentActorScene.events.off('postupdate',synchronizeCharacterOutlineLayers);
    for (const currentOutlineLayer of currentOutlineLayers) currentOutlineLayer.image.destroy();
  });
}
