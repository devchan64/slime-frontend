import type Phaser from 'phaser';
import {CHARACTER_CONTACT_SHADOW_COLOR,CHARACTER_CONTACT_SHADOW_ALPHA_SCALE} from '../renderQuality';
import {resolveFieldActorContactShadow} from '../../../packages/field-renderer/field-renderer.mjs';

/** 사람 캐릭터의 게임·검수 접지 그림자를 동일하게 그린다. */
export function drawCharacterContactShadow(currentShadowGraphic:Phaser.GameObjects.Graphics,currentScreenPosition:{x:number;y:number}){
 const currentShadowMetrics=resolveFieldActorContactShadow('contrast');
 for(const currentShadowLayer of [currentShadowMetrics.outer,currentShadowMetrics.core]){
  currentShadowGraphic.fillStyle(CHARACTER_CONTACT_SHADOW_COLOR,Math.min(1,currentShadowLayer.alpha*CHARACTER_CONTACT_SHADOW_ALPHA_SCALE));
  currentShadowGraphic.fillEllipse(currentScreenPosition.x,currentScreenPosition.y,currentShadowLayer.width,currentShadowLayer.height);
 }
}
