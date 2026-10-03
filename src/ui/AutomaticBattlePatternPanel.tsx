import {useState} from 'preact/hooks';
import {useTranslation} from '../i18n';
import type {State, AutomaticBattleRule} from '../client/types';

const AUTOMATIC_PATTERN_RULE_LIMIT = 10;
const AUTOMATIC_PATTERN_CONDITIONS = ['ALWAYS','SELF_HP','ALLY_HP'] as const;
const AUTOMATIC_PATTERN_ACTIONS = ['ATTACK','SKILL','APPROACH','END_TURN'] as const;
const AUTOMATIC_PATTERN_CONDITION_LABELS = {ALWAYS:'patternConditionAlways',SELF_HP:'patternConditionSelfHp',ALLY_HP:'patternConditionAllyHp'} as const;
const AUTOMATIC_PATTERN_ACTION_LABELS = {ATTACK:'patternActionAttack',SKILL:'patternActionSkill',APPROACH:'patternActionApproach',END_TURN:'patternActionEndTurn'} as const;
const AUTOMATIC_PATTERN_END_RULE: AutomaticBattleRule = {condition:'ALWAYS',action:'END_TURN'};

export function AutomaticBattlePatternPanel({currentCharacterState, currentActionsDisabled, submitPatternCommand}: {
  currentCharacterState: State['me']; currentActionsDisabled: boolean;
  submitPatternCommand: (currentCommandPath: string, currentCommandBody: Record<string, unknown>, currentSuccessHandler: () => void) => unknown;
}) {
  const {t} = useTranslation();
  const [currentPatternRules, setCurrentPatternRules] = useState<AutomaticBattleRule[]>(() =>
    structuredClone(currentCharacterState.automaticPattern?.rules ?? [AUTOMATIC_PATTERN_END_RULE]));
  const [currentSaveComplete, setCurrentSaveComplete] = useState(false);
  const currentAvailableActions = (currentCharacterState.battleSkillLoadout ?? []).flatMap(currentSkillIdentifier =>
    currentCharacterState.skillUseLocks?.[currentSkillIdentifier] ? [] :
    (currentCharacterState.skillDefinitions?.[currentSkillIdentifier]?.actions ?? []).filter(currentActionRecord =>
      (currentCharacterState.skills[currentSkillIdentifier] ?? 0) >= currentActionRecord.requiredLevel));
  const currentInvalidRules = currentPatternRules.some(currentRuleRecord =>
    (currentRuleRecord.condition !== 'ALWAYS' && (!Number.isInteger(currentRuleRecord.hpPercent) || currentRuleRecord.hpPercent! < 1 || currentRuleRecord.hpPercent! > 100)) ||
    (currentRuleRecord.action === 'SKILL' && !currentAvailableActions.some(currentActionRecord => currentActionRecord.actionId === currentRuleRecord.actionId)));
  const updatePatternRules = (requestedPatternRules: AutomaticBattleRule[]) => {
    setCurrentPatternRules(requestedPatternRules); setCurrentSaveComplete(false);
  };
  const replacePatternRule = (currentRuleIndex: number, requestedRuleRecord: AutomaticBattleRule) =>
    updatePatternRules(currentPatternRules.map((currentRuleRecord, currentEntryIndex) => currentEntryIndex === currentRuleIndex ? requestedRuleRecord : currentRuleRecord));
  const movePatternRule = (currentRuleIndex: number, requestedIndexOffset: number) => {
    const requestedPatternRules = [...currentPatternRules];
    const requestedTargetIndex = currentRuleIndex + requestedIndexOffset;
    [requestedPatternRules[currentRuleIndex],requestedPatternRules[requestedTargetIndex]] = [requestedPatternRules[requestedTargetIndex],requestedPatternRules[currentRuleIndex]];
    updatePatternRules(requestedPatternRules);
  };
  return <section class="card automatic-pattern-panel" aria-labelledby="automatic-pattern-heading">
    <h2 id="automatic-pattern-heading">{t('battle.patternTitle')}</h2>
    <p>{t('battle.patternHelp')}</p>
    <fieldset disabled={currentActionsDisabled}>
      {currentPatternRules.map((currentRuleRecord, currentRuleIndex) => <fieldset key={currentRuleIndex}>
        <legend>{t('battle.patternRuleNumber',{number:currentRuleIndex+1})}</legend>
        {currentRuleIndex === currentPatternRules.length-1 ? <p>{t('battle.patternEndRule')}</p> : <>
          <label>{t('battle.patternCondition')}<select value={currentRuleRecord.condition} onChange={currentInputEvent => {
            const requestedConditionValue = currentInputEvent.currentTarget.value as AutomaticBattleRule['condition'];
            replacePatternRule(currentRuleIndex,{...currentRuleRecord,condition:requestedConditionValue,hpPercent:requestedConditionValue === 'ALWAYS' ? null : currentRuleRecord.hpPercent ?? 50});
          }}>{AUTOMATIC_PATTERN_CONDITIONS.map(currentConditionValue => <option value={currentConditionValue}>{t(`battle.${AUTOMATIC_PATTERN_CONDITION_LABELS[currentConditionValue]}`)}</option>)}</select></label>
          {currentRuleRecord.condition !== 'ALWAYS' && <label>{t('battle.patternHpPercent')}<input type="number" min="1" max="100" step="1" value={Number.isFinite(currentRuleRecord.hpPercent) ? currentRuleRecord.hpPercent! : ''}
            onInput={currentInputEvent => replacePatternRule(currentRuleIndex,{...currentRuleRecord,hpPercent:currentInputEvent.currentTarget.valueAsNumber})}/></label>}
          <label>{t('battle.patternAction')}<select value={currentRuleRecord.action} onChange={currentInputEvent => {
            const requestedActionValue = currentInputEvent.currentTarget.value as AutomaticBattleRule['action'];
            replacePatternRule(currentRuleIndex,{...currentRuleRecord,action:requestedActionValue,actionId:requestedActionValue === 'SKILL' ? currentAvailableActions[0]?.actionId ?? null : null});
          }}>{AUTOMATIC_PATTERN_ACTIONS.map(currentActionValue => <option value={currentActionValue} disabled={currentActionValue === 'SKILL' && currentAvailableActions.length === 0}>{t(`battle.${AUTOMATIC_PATTERN_ACTION_LABELS[currentActionValue]}`)}</option>)}</select></label>
          {currentRuleRecord.action === 'SKILL' && <label>{t('battle.patternSkillAction')}<select value={currentRuleRecord.actionId ?? ''} onChange={currentInputEvent => replacePatternRule(currentRuleIndex,{...currentRuleRecord,actionId:currentInputEvent.currentTarget.value})}>
            {!currentAvailableActions.some(currentActionRecord => currentActionRecord.actionId === currentRuleRecord.actionId) && <option value={currentRuleRecord.actionId ?? ''}>{t('battle.patternMissingSkill')}</option>}
            {currentAvailableActions.map(currentActionRecord => <option value={currentActionRecord.actionId}>{currentActionRecord.name}</option>)}
          </select></label>}
          <div class="field-menu-actions">
            <button class="secondary" disabled={currentRuleIndex===0} onClick={() => movePatternRule(currentRuleIndex,-1)}>{t('battle.patternMoveUp')}</button>
            <button class="secondary" disabled={currentRuleIndex>=currentPatternRules.length-2} onClick={() => movePatternRule(currentRuleIndex,1)}>{t('battle.patternMoveDown')}</button>
            <button class="secondary" onClick={() => updatePatternRules(currentPatternRules.filter((currentRuleEntry,currentEntryIndex) => currentEntryIndex!==currentRuleIndex))}>{t('battle.patternRemoveRule')}</button>
          </div>
        </>}
      </fieldset>)}
      <button class="secondary" disabled={currentPatternRules.length>=AUTOMATIC_PATTERN_RULE_LIMIT} onClick={() => updatePatternRules([...currentPatternRules.slice(0,-1),{condition:'ALWAYS',action:'ATTACK'},AUTOMATIC_PATTERN_END_RULE])}>{t('battle.patternAddRule')}</button>
      {currentPatternRules.length>=AUTOMATIC_PATTERN_RULE_LIMIT && <p>{t('battle.patternRuleLimit')}</p>}
      {currentInvalidRules && <p role="alert">{t('battle.patternInvalidRules')}</p>}
      <div class="field-menu-actions">
        <button disabled={currentInvalidRules} onClick={() => submitPatternCommand('/v1/characters/me/automatic-pattern',{pattern:{version:1,rules:currentPatternRules}},() => setCurrentSaveComplete(true))}>{t('battle.patternSave')}</button>
        <button class="secondary" onClick={() => updatePatternRules(structuredClone(currentCharacterState.automaticPattern?.rules ?? [AUTOMATIC_PATTERN_END_RULE]))}>{t('battle.patternReload')}</button>
        <button class="secondary" disabled={!currentCharacterState.automaticPattern} onClick={() => submitPatternCommand('/v1/characters/me/automatic-pattern',{pattern:null},() => {
          setCurrentPatternRules([AUTOMATIC_PATTERN_END_RULE]); setCurrentSaveComplete(true);
        })}>{t('battle.patternDelete')}</button>
      </div>
    </fieldset>
    {currentSaveComplete && <p role="status">{t('battle.patternSaved')}</p>}
  </section>;
}
