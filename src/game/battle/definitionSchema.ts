import {parseDocument} from 'yaml';

const PRESENTATION_FIXED_POLICIES={schemaVersion:1,definitionVersion:1,attackClipPolicy:'registered-idle',reactionClipPolicy:'registered-idle',hitPointPolicy:'opaque-body-center',missingMarkerPolicy:'last-frame-entry',projectilePolicy:'instant-effect',soundPolicy:'silent'} as const;
const PRESENTATION_NUMERIC_FIELDS=['initialGapViewportRatio','healingEffectDurationMs','layoutDurationMs','recoveryDurationMs','effectDurationMs','maximumDurationMs','heightViewportRatio','groundViewportRatio','contactBodyGapRatio','preparationBodyRatio','attackBodyRatio','hitBodyRatio','guardBodyRatio','missBodyRatio','reactionRiseMs'] as const;
export type BattlePresentationDefinition=typeof PRESENTATION_FIXED_POLICIES&Record<typeof PRESENTATION_NUMERIC_FIELDS[number],number>;
/** 게시된 표현 정의만 허용한다. 누락·오타를 암묵적 기본값으로 대체하지 않는다. */
export function parseBattlePresentationDefinition(currentDefinitionSource:string):BattlePresentationDefinition {
  const currentYamlDocument=parseDocument(currentDefinitionSource,{uniqueKeys:true});
  if(currentYamlDocument.errors.length)throw Error('전투 연출 정의 YAML 오류: '+currentYamlDocument.errors[0].message);
  const currentDefinitionRecord=currentYamlDocument.toJS();
  const currentAllowedFields=new Set([...Object.keys(PRESENTATION_FIXED_POLICIES),...PRESENTATION_NUMERIC_FIELDS]);
  if(!currentDefinitionRecord||typeof currentDefinitionRecord!=='object'||Array.isArray(currentDefinitionRecord)||Object.keys(currentDefinitionRecord).some(currentFieldName=>!currentAllowedFields.has(currentFieldName)))throw Error('전투 연출 정의 필드 오류');
  for(const [currentPolicyName,currentPolicyValue] of Object.entries(PRESENTATION_FIXED_POLICIES))
    if(currentDefinitionRecord[currentPolicyName]!==currentPolicyValue)throw Error('지원하지 않는 전투 연출 정책: '+currentPolicyName);
  for(const currentNumericField of PRESENTATION_NUMERIC_FIELDS){
    const currentNumericValue=currentDefinitionRecord[currentNumericField];
    if(typeof currentNumericValue!=='number'||!Number.isFinite(currentNumericValue)||currentNumericValue<=0||
      (currentNumericField.endsWith('Ratio')&&currentNumericValue>=1))throw Error('전투 연출 수치 오류: '+currentNumericField);
  }
  if(currentDefinitionRecord.maximumDurationMs>5000||currentDefinitionRecord.effectDurationMs>currentDefinitionRecord.recoveryDurationMs||currentDefinitionRecord.reactionRiseMs>currentDefinitionRecord.recoveryDurationMs)throw Error('전투 연출 시간 한도 오류');
  return Object.freeze(currentDefinitionRecord) as BattlePresentationDefinition;
}
