import {CHARACTER_OUTLINE_DEPTH_STEP} from '../../../packages/field-renderer/render-constants.mjs';
export {CHARACTER_OUTLINE_DEPTH_STEP} from '../../../packages/field-renderer/render-constants.mjs';
import type Phaser from 'phaser';
import {GAME_INTERNAL_RESOLUTION_SCALE, CHARACTER_OUTLINE_BASE_WIDTH, CHARACTER_OUTLINE_BASE_COLOR, CHARACTER_SEPARATOR_BASE_WIDTH, CHARACTER_SEPARATOR_BASE_COLOR} from '../renderQuality';

const CHARACTER_OUTLINE_SAMPLE_OFFSETS = [[-1,0],[1,0],[0,-1],[0,1],[-0.707,-0.707],[0.707,-0.707],[-0.707,0.707],[0.707,0.707]];

/** 원본 프레임·앵커·이동을 따라가며 밝은 분리선은 화면 기준 1px를 유지한다. */
export function attachCharacterOutlineLayers(currentActorImage: Phaser.GameObjects.Image) {
  const currentActorScene = currentActorImage.scene;
  const currentOutlineLayers = [
    {color: CHARACTER_SEPARATOR_BASE_COLOR, radius: CHARACTER_OUTLINE_BASE_WIDTH + CHARACTER_SEPARATOR_BASE_WIDTH, depth: 2},
    {color: CHARACTER_OUTLINE_BASE_COLOR, radius: CHARACTER_OUTLINE_BASE_WIDTH, depth: 1},
  ].flatMap(currentLayerStyle => CHARACTER_OUTLINE_SAMPLE_OFFSETS.map(([currentOffsetHorizontal,currentOffsetVertical]) => ({
    image: currentActorScene.add.image(currentActorImage.x,currentActorImage.y,currentActorImage.texture.key,currentActorImage.frame.name)
      .setTintFill(currentLayerStyle.color).setData('characterOutlineLayer',true),
    horizontal: currentOffsetHorizontal,
    vertical: currentOffsetVertical,
    radius: currentLayerStyle.radius,
    depth: currentLayerStyle.depth,
    color: currentLayerStyle.color,
    previousAmbientTint: -1,
  })));
  const synchronizeCharacterOutlineLayers = () => {
    const currentAmbientTint=currentActorImage.getData('terrainAmbientTint')??0xffffff;
    const currentSeparatorRadius=CHARACTER_OUTLINE_BASE_WIDTH + CHARACTER_SEPARATOR_BASE_WIDTH * GAME_INTERNAL_RESOLUTION_SCALE / currentActorScene.cameras.main.zoom;
    for (const currentOutlineLayer of currentOutlineLayers) {
      const currentOutlineImage=currentOutlineLayer.image;
      const currentOutlineRadius=currentOutlineLayer.depth===2?currentSeparatorRadius:currentOutlineLayer.radius;
      const currentOutlinePositionX=currentActorImage.x + currentOutlineLayer.horizontal * currentOutlineRadius;
      const currentOutlinePositionY=currentActorImage.y + currentOutlineLayer.vertical * currentOutlineRadius;
      const currentOutlineDepth=currentActorImage.depth - currentOutlineLayer.depth * CHARACTER_OUTLINE_DEPTH_STEP;
      if(currentOutlineLayer.previousAmbientTint!==currentAmbientTint){
        const currentOutlineTint=[16,8,0].reduce((currentPackedColor,currentChannelShift)=>currentPackedColor|(Math.round(((currentOutlineLayer.color>>currentChannelShift)&255)*((currentAmbientTint>>currentChannelShift)&255)/255)<<currentChannelShift),0);
        currentOutlineImage.setTintFill(currentOutlineTint);
        currentOutlineLayer.previousAmbientTint=currentAmbientTint;
      }
      // 같은 값의 setDepth도 전체 표시 목록 정렬을 예약하므로 변경 시에만 적용한다.
      if(currentOutlineImage.texture!==currentActorImage.texture || currentOutlineImage.frame!==currentActorImage.frame)
        currentOutlineImage.setTexture(currentActorImage.texture.key,currentActorImage.frame.name);
      if(currentOutlineImage.originX!==currentActorImage.originX || currentOutlineImage.originY!==currentActorImage.originY)
        currentOutlineImage.setOrigin(currentActorImage.originX,currentActorImage.originY);
      if(currentOutlineImage.scaleX!==currentActorImage.scaleX || currentOutlineImage.scaleY!==currentActorImage.scaleY)
        currentOutlineImage.setScale(currentActorImage.scaleX,currentActorImage.scaleY);
      if(currentOutlineImage.flipX!==currentActorImage.flipX || currentOutlineImage.flipY!==currentActorImage.flipY)
        currentOutlineImage.setFlip(currentActorImage.flipX,currentActorImage.flipY);
      if(currentOutlineImage.rotation!==currentActorImage.rotation)currentOutlineImage.setRotation(currentActorImage.rotation);
      if(currentOutlineImage.x!==currentOutlinePositionX || currentOutlineImage.y!==currentOutlinePositionY)
        currentOutlineImage.setPosition(currentOutlinePositionX,currentOutlinePositionY);
      if(currentOutlineImage.depth!==currentOutlineDepth)currentOutlineImage.setDepth(currentOutlineDepth);
      if(currentOutlineImage.visible!==currentActorImage.visible)currentOutlineImage.setVisible(currentActorImage.visible);
      if(currentOutlineImage.alpha!==currentActorImage.alpha)currentOutlineImage.setAlpha(currentActorImage.alpha);
      if(currentOutlineImage.scrollFactorX!==currentActorImage.scrollFactorX || currentOutlineImage.scrollFactorY!==currentActorImage.scrollFactorY)
        currentOutlineImage.setScrollFactor(currentActorImage.scrollFactorX,currentActorImage.scrollFactorY);
    }
  };
  synchronizeCharacterOutlineLayers();
  currentActorScene.events.on('postupdate',synchronizeCharacterOutlineLayers);
  currentActorImage.once('destroy',() => {
    currentActorScene.events.off('postupdate',synchronizeCharacterOutlineLayers);
    for (const currentOutlineLayer of currentOutlineLayers) currentOutlineLayer.image.destroy();
  });
}
