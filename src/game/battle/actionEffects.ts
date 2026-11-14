import type Phaser from 'phaser';
export const BATTLE_BACKGROUND_TEXTURE_KEY='battle-forest-clearing-v1';
const BATTLE_BACKGROUND_SOURCE_URL=new URL('../../../../slime-assets/assets/backgrounds/battle/forest-clearing-v1.png',import.meta.url).href;
export const BATTLE_HEALING_TEXTURE_KEY='battle-healing-v1';
export const BATTLE_IMPACT_TEXTURE_KEY='battle-impact-v1';
const BATTLE_HEALING_SOURCE_URL=new URL('../../../../slime-assets/assets/sprites/effects/battle/healing-v1.png',import.meta.url).href;
const BATTLE_IMPACT_SOURCE_URL=new URL('../../../../slime-assets/assets/sprites/effects/battle/impact-v1.png',import.meta.url).href;
export function preloadBattleActionEffects(currentRenderScene:Phaser.Scene){
  if(!currentRenderScene.textures.exists(BATTLE_BACKGROUND_TEXTURE_KEY))currentRenderScene.load.image(BATTLE_BACKGROUND_TEXTURE_KEY,BATTLE_BACKGROUND_SOURCE_URL);
  if(!currentRenderScene.textures.exists(BATTLE_HEALING_TEXTURE_KEY))currentRenderScene.load.image(BATTLE_HEALING_TEXTURE_KEY,BATTLE_HEALING_SOURCE_URL);
  if(!currentRenderScene.textures.exists(BATTLE_IMPACT_TEXTURE_KEY))currentRenderScene.load.image(BATTLE_IMPACT_TEXTURE_KEY,BATTLE_IMPACT_SOURCE_URL);
}
