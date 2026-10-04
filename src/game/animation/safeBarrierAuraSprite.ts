import Phaser from 'phaser';
import {drawFieldAuraPanel,FIELD_SAFE_AURA_PROFILE} from '../../../packages/field-renderer/field-renderer.mjs';

export const SAFE_BARRIER_AURA_SPRITE_CONTRACT = Object.freeze({frameWidthPixels:64,frameHeightPixels:64,frameColumnCount:FIELD_SAFE_AURA_PROFILE.columns,frameRowCount:FIELD_SAFE_AURA_PROFILE.rows,frameTotalCount:FIELD_SAFE_AURA_PROFILE.frames,displayHeightPixels:FIELD_SAFE_AURA_PROFILE.height});
export const SAFE_BARRIER_AURA_TEXTURE_KEY = 'safe-barrier-aura';
const SAFE_BARRIER_AURA_SOURCE_URL = new URL('../../../../slime-assets/assets/sprites/effects/safe-barrier/safe-barrier-aura-v1-source.png',import.meta.url).href;

export function preloadSafeBarrierAuraSprite(currentGameScene:Phaser.Scene){
 currentGameScene.load.image(SAFE_BARRIER_AURA_TEXTURE_KEY,SAFE_BARRIER_AURA_SOURCE_URL);
}

/** 공용 렌더러가 타일 엣지의 꼭짓점·UV·애니메이션을 함께 관리한다. */
export function createSafeBarrierAuraSprite(currentGameScene:Phaser.Scene,currentPanelPoints:{x:number;y:number}[],currentRenderDepth:number){
 return drawFieldAuraPanel(currentGameScene,currentPanelPoints,SAFE_BARRIER_AURA_TEXTURE_KEY,currentRenderDepth);
}
