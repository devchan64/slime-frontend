import type Phaser from 'phaser';
import type {FieldCombatIndicator, Position} from '../../client/types';
import type {FieldVanishSample} from './fieldBattleTimeline';
import {BOARD_ANIMATION_FRAME_RATE} from './boardAnimation';

const FIELD_BATTLE_TEXTURE_KEY = 'field-battle-active-v1';
const FIELD_VANISH_TEXTURE_KEY = 'field-monster-vanish-v1';
const FIELD_BATTLE_TEXTURE_URL = new URL('../../../../slime-assets/assets/sprites/effects/field-battle/field-battle-active-v1.png', import.meta.url).href;
const FIELD_VANISH_TEXTURE_URL = new URL('../../../../slime-assets/assets/sprites/effects/field-battle/field-monster-vanish-v1.png', import.meta.url).href;
const FIELD_BATTLE_DISPLAY_WIDTH = 56;
const FIELD_BATTLE_HEAD_OFFSET = 34;
const FIELD_BATTLE_LABEL_OFFSET = 22;
const FIELD_BATTLE_PULSE_OPACITY = 0.18;
const FIELD_VANISH_DISPLAY_WIDTH = 150;
const FIELD_VANISH_BASE_OFFSET = 35;
const FIELD_VANISH_RISE_DISTANCE = 50;
const FIELD_EFFECT_DEPTH_OFFSET = 0.02;
const FIELD_BATTLE_LABEL_STYLE = {fontFamily:'sans-serif', fontSize:'12px', color:'#fff2cd',
  backgroundColor:'#33241dcc', padding:{x:5,y:2}};

export function preloadFieldBattleEffects(currentSceneInstance: Phaser.Scene) {
  currentSceneInstance.load.image(FIELD_BATTLE_TEXTURE_KEY, FIELD_BATTLE_TEXTURE_URL);
  currentSceneInstance.load.image(FIELD_VANISH_TEXTURE_KEY, FIELD_VANISH_TEXTURE_URL);
}

export function createFieldCombatIndicator(currentSceneInstance: Phaser.Scene, currentActorPlacement: {x:number;y:number},
  currentActorHeight: number, currentAnnotationDepth: number, currentCombatIndicator: FieldCombatIndicator) {
  if (currentCombatIndicator.effect !== 'BATTLE_ACTIVE') throw new Error('지원하지 않는 필드 전투 표시입니다.');
  const currentEffectImage = currentSceneInstance.add.image(currentActorPlacement.x,
    currentActorPlacement.y-currentActorHeight-FIELD_BATTLE_HEAD_OFFSET, FIELD_BATTLE_TEXTURE_KEY)
    .setDisplaySize(FIELD_BATTLE_DISPLAY_WIDTH,FIELD_BATTLE_DISPLAY_WIDTH).setDepth(currentAnnotationDepth);
  currentEffectImage.setData('fieldCombatIndicator',true);
  currentSceneInstance.add.text(currentActorPlacement.x,
    currentEffectImage.y-FIELD_BATTLE_LABEL_OFFSET,currentCombatIndicator.label ?? currentCombatIndicator.labelTranslations.ko,
    FIELD_BATTLE_LABEL_STYLE).setOrigin(0.5,1).setDepth(currentAnnotationDepth+FIELD_EFFECT_DEPTH_OFFSET);
}

export function animateFieldCombatIndicator(currentEffectImage: Phaser.GameObjects.Image, currentRenderTimestamp: number) {
  const currentFrameElapsed = Math.floor(currentRenderTimestamp*BOARD_ANIMATION_FRAME_RATE/1000)/BOARD_ANIMATION_FRAME_RATE;
  const reducedMotionActive = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  currentEffectImage.setAlpha(reducedMotionActive ? 1 : 1-FIELD_BATTLE_PULSE_OPACITY*(1+Math.sin(currentFrameElapsed*Math.PI*2)));
}

/** 화면 재작성·회전에도 서버 이벤트의 남은 시간으로 재구성한다. */
export class FieldBattleEffectLayer {
  private currentEffectImages = new Map<string, Phaser.GameObjects.Image>();

  renderBattleEffects(currentSceneInstance: Phaser.Scene, currentEffectSamples: FieldVanishSample[],
    projectFieldPosition: (currentFieldPosition: Position)=>{x:number;y:number;depth:number}) {
    const currentEventIdentifiers = new Set(currentEffectSamples.map(currentEffectSample=>currentEffectSample.event.eventId));
    for (const [currentEventIdentifier,currentEffectImage] of this.currentEffectImages) {
      if (!currentEventIdentifiers.has(currentEventIdentifier) || !currentEffectImage.scene) {
        if (currentEffectImage.scene) currentEffectImage.destroy();
        this.currentEffectImages.delete(currentEventIdentifier);
      }
    }
    const reducedMotionActive = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const currentEffectSample of currentEffectSamples) {
      let currentEffectImage = this.currentEffectImages.get(currentEffectSample.event.eventId);
      if (!currentEffectImage) {
        currentEffectImage=currentSceneInstance.add.image(0,0,FIELD_VANISH_TEXTURE_KEY);
        currentEffectImage.setData('fieldBattleEventId',currentEffectSample.event.eventId);
        this.currentEffectImages.set(currentEffectSample.event.eventId,currentEffectImage);
      }
      const currentEffectPlacement = projectFieldPosition(currentEffectSample.event.position);
      const currentEffectProgress = Math.floor(currentEffectSample.progress*BOARD_ANIMATION_FRAME_RATE*2)/(BOARD_ANIMATION_FRAME_RATE*2);
      const currentEffectWidth = FIELD_VANISH_DISPLAY_WIDTH*(reducedMotionActive ? 1 : 0.8+currentEffectProgress*0.6);
      currentEffectImage.setPosition(currentEffectPlacement.x,currentEffectPlacement.y-FIELD_VANISH_BASE_OFFSET-
        (reducedMotionActive ? 0 : currentEffectProgress*FIELD_VANISH_RISE_DISTANCE))
        .setDisplaySize(currentEffectWidth,currentEffectWidth*currentEffectImage.height/currentEffectImage.width).setAlpha(1-currentEffectSample.progress)
        .setDepth(currentEffectPlacement.depth+FIELD_EFFECT_DEPTH_OFFSET);
    }
  }

  clearBattleEffects() {
    for (const currentEffectImage of this.currentEffectImages.values()) if (currentEffectImage.scene) currentEffectImage.destroy();
    this.currentEffectImages.clear();
  }
}
