import Phaser from 'phaser';
import type {Position} from '../../client/types';
import {buildFieldBoundaryPanels} from '../../../packages/field-renderer/field-renderer.mjs';
import {createSafeBarrierAuraSprite} from '../animation/safeBarrierAuraSprite';

/** 게임과 검수는 공용 외곽 판정으로 접촉 셀 사이의 결계를 제외한다. */
export function drawSafeBoundaryAura(currentGameScene:Phaser.Scene,currentBoundaryObjects:Phaser.GameObjects.Mesh[],currentScreenCenter:{x:number;y:number},currentViewPosition:Position,currentSafeCenter:Position,currentSafeRadius:number,currentRenderDepth:number){
 for(const currentPanelPoints of buildFieldBoundaryPanels(currentViewPosition,currentSafeCenter,currentSafeRadius,currentScreenCenter))currentBoundaryObjects.push(createSafeBarrierAuraSprite(currentGameScene,currentPanelPoints,currentRenderDepth));
}
