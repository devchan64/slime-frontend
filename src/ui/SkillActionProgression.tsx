import type {SkillActionProgression as SkillActionDefinition} from '../client/skillText';
import {useTranslation} from '../i18n';

export function SkillActionProgression({currentSkillActions,currentSkillLevel,currentSkillLocked}:{
  currentSkillActions?:SkillActionDefinition[];currentSkillLevel:number;currentSkillLocked:boolean;
}){
  const {t:translateActionProgression}=useTranslation();
  if(!currentSkillActions?.length)return null;
  return <div class="skill-action-progression">{currentSkillActions.map(currentActionDefinition=>
    <div key={currentActionDefinition.actionId}>
      <p><strong>{currentActionDefinition.actionId==='one_hand_finishing_strike'
        ?translateActionProgression('battle.finishingStrike'):currentActionDefinition.name}</strong>
        {' · '}{translateActionProgression(currentSkillLevel>=currentActionDefinition.requiredLevel
          ?'character.actionUnlocked':'character.actionUnlockLevel',{level:currentActionDefinition.requiredLevel})}</p>
      <p>{translateActionProgression(currentActionDefinition.effect==='healing'?'character.actionHealingPower':currentActionDefinition.effect==='magic_damage'?'character.actionMagicPower':'character.actionCostPower',{ap:currentActionDefinition.apCost,
        power:currentActionDefinition.powerBasisPoints/10000})}</p>
      <p>{translateActionProgression(currentActionDefinition.requiredEquipment==='one_handed_sword'?'character.actionSwordRequirement':currentActionDefinition.requiredEquipment==='two_handed_sword'?'character.actionGreatswordRequirement':'character.actionGeneralRequirement')}</p>
      {currentActionDefinition.minimumRange!==undefined&&<p>{translateActionProgression('character.actionRange',{minimum:currentActionDefinition.minimumRange,maximum:currentActionDefinition.maximumRange!})}</p>}
      {currentActionDefinition.requiresFeedingAnatomy&&<p>{translateActionProgression('character.actionFeedingRequirement')}</p>}
      {!!currentActionDefinition.drainBasisPoints&&<p>{translateActionProgression('character.actionDrainRate',{percent:currentActionDefinition.drainBasisPoints/100})}</p>}
      {currentSkillLocked&&<p>{translateActionProgression('character.skillUseLocked')}</p>}
    </div>)}</div>;
}
