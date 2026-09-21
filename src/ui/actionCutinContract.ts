import type { ActionCutinEvent } from './actionCutins';

const ACTION_CUTIN_EVENT_FIELDS = ['actionId','battleId','sequence','unitId','actorName','actionType','skillId','appearance'];
const ACTION_CUTIN_DUEL_FIELDS = [...ACTION_CUTIN_EVENT_FIELDS,'targetUnitId','targetName','targetAppearance'];
const CHARACTER_APPEARANCE_FIELDS = ['kind','groups'];
const CHARACTER_GROUP_FIELDS = ['costume','hair','face'];
const MONSTER_APPEARANCE_FIELDS = ['kind','group'];

function requireExactCutinFields(currentUnknownRecord: unknown, expectedFieldNames: string[]): Record<string, unknown> {
  if (!currentUnknownRecord || typeof currentUnknownRecord !== 'object' || Array.isArray(currentUnknownRecord)) {
    throw new Error('액션 컷인 객체 형식이 올바르지 않습니다.');
  }
  const currentRecordFields = Object.keys(currentUnknownRecord);
  if (currentRecordFields.length !== expectedFieldNames.length || expectedFieldNames.some(currentFieldName => !Object.hasOwn(currentUnknownRecord,currentFieldName))) {
    throw new Error('액션 컷인의 필수 필드 또는 계약 버전이 올바르지 않습니다.');
  }
  return currentUnknownRecord as Record<string,unknown>;
}
function requireCutinTextValue(currentTextValue: unknown): asserts currentTextValue is string {
  if (typeof currentTextValue !== 'string' || !currentTextValue.trim()) throw new Error('액션 컷인 문자열이 올바르지 않습니다.');
}

export function parseActionCutinEvent(currentUnknownEvent: unknown): ActionCutinEvent {
  if (!currentUnknownEvent || typeof currentUnknownEvent !== 'object' || Array.isArray(currentUnknownEvent)) throw new Error('액션 컷인 객체 형식이 올바르지 않습니다.');
  const currentEventFieldNames = Object.keys(currentUnknownEvent);
  const isDuelCutin = currentEventFieldNames.length === ACTION_CUTIN_DUEL_FIELDS.length
    && ACTION_CUTIN_DUEL_FIELDS.every(currentFieldName => currentEventFieldNames.includes(currentFieldName));
  const currentEventRecord = requireExactCutinFields(currentUnknownEvent,isDuelCutin ? ACTION_CUTIN_DUEL_FIELDS : ACTION_CUTIN_EVENT_FIELDS);
  for (const currentFieldName of ['actionId','battleId','unitId','actorName','actionType']) requireCutinTextValue(currentEventRecord[currentFieldName]);
  if (!Number.isSafeInteger(currentEventRecord.sequence) || (currentEventRecord.sequence as number) < 1) throw new Error('액션 컷인 순번이 올바르지 않습니다.');
  if (currentEventRecord.actionId !== `${currentEventRecord.battleId}:${currentEventRecord.sequence}`) throw new Error('액션 컷인 식별자와 순번이 일치하지 않습니다.');
  if (currentEventRecord.skillId !== null) requireCutinTextValue(currentEventRecord.skillId);
  if ((currentEventRecord.actionType === 'ATTACK' && currentEventRecord.skillId !== null)
      || (currentEventRecord.actionType === 'SKILL' && currentEventRecord.skillId === null)) throw new Error('액션 컷인 명령과 스킬 식별자가 일치하지 않습니다.');
  function validateCutinAppearance(currentAppearanceRecord: unknown) {
    const currentAppearanceObject = currentAppearanceRecord as Record<string,unknown> | null;
    if (currentAppearanceObject?.kind === 'character') {
    requireExactCutinFields(currentAppearanceRecord,CHARACTER_APPEARANCE_FIELDS);
    const currentAppearanceGroups = requireExactCutinFields(currentAppearanceObject.groups,CHARACTER_GROUP_FIELDS);
    for (const currentFieldName of CHARACTER_GROUP_FIELDS) requireCutinTextValue(currentAppearanceGroups[currentFieldName]);
    } else if (currentAppearanceObject?.kind === 'monster') {
    requireExactCutinFields(currentAppearanceRecord,MONSTER_APPEARANCE_FIELDS);
    requireCutinTextValue(currentAppearanceObject.group);
    } else throw new Error('액션 컷인 외형 종류가 올바르지 않습니다.');
  }
  validateCutinAppearance(currentEventRecord.appearance);
  if (isDuelCutin) {
    requireCutinTextValue(currentEventRecord.targetUnitId);
    requireCutinTextValue(currentEventRecord.targetName);
    validateCutinAppearance(currentEventRecord.targetAppearance);
  }
  // 등록된 이미지 존재 여부는 에셋 조회 경계에서 검사한다.
  return structuredClone(currentEventRecord) as ActionCutinEvent;
}
