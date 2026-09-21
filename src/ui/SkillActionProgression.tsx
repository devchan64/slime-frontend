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
      <p>{translateActionProgression('character.actionCostPower',{ap:currentActionDefinition.apCost,
        power:currentActionDefinition.powerBasisPoints/10000})}</p>
      <p>{translateActionProgression('character.actionSwordRequirement')}</p>
      {currentSkillLocked&&<p>{translateActionProgression('character.skillUseLocked')}</p>}
    </div>)}</div>;
}
