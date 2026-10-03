type Locale = 'ko' | 'en';
type Pair<K extends string> = Record<Locale, Record<K, string>>;
export type AchievementDefinition = {
  name: string; scope: 'GENERAL' | 'SEASONAL'; cp: number; sp?: number; skills?: string[];
  translations?: Pair<'name'>;
  checklist: Record<string, {description: string; target: number; translations?: Pair<'description'>}>;
};

function translated<K extends string>(original: string, pair: Pair<K> | undefined, key: K, locale: Locale): string {
  // 번역 필드가 없는 이전 v1 서버의 원문 표시만 호환한다.
  if (pair === undefined) return original;
  if (!pair || typeof pair !== 'object' || Object.keys(pair).sort().join() !== 'en,ko')
    throw new Error('업적 번역에는 한국어와 영어가 모두 필요합니다.');
  for (const value of Object.values(pair) as Record<K, string>[]) {
    if (!value || typeof value !== 'object' || Object.keys(value).join() !== key
        || typeof value[key] !== 'string' || !value[key].trim())
      throw new Error('업적 번역 내용이 올바르지 않습니다.');
  }
  return pair[locale][key];
}

export function localizedAchievement(definition: AchievementDefinition, locale: Locale): AchievementDefinition {
  return {...definition, name: translated(definition.name, definition.translations, 'name', locale),
    checklist: Object.fromEntries(Object.entries(definition.checklist).map(([id, criterion]) => [id,
      {...criterion, description: translated(criterion.description, criterion.translations, 'description', locale)}]))};
}

/** 과거 정의 누락을 현재 카탈로그로 대체하면 다른 시즌의 기록이 섞이므로 거절한다. */
export function validateAchievementSeasonHistory(currentHistoryValue: unknown): void {
  if (!currentHistoryValue || typeof currentHistoryValue !== 'object' || Array.isArray(currentHistoryValue))
    throw new Error('과거 시즌 업적 이력이 객체가 아닙니다.');
  for (const currentSeasonRecord of Object.values(currentHistoryValue)) {
    if (!currentSeasonRecord || typeof currentSeasonRecord !== 'object' || Array.isArray(currentSeasonRecord))
      throw new Error('과거 시즌 업적 기록이 올바르지 않습니다.');
    for (const currentRecordField of ['catalog', 'achievements', 'seasonalAchievements']) {
      if (!currentSeasonRecord[currentRecordField] || typeof currentSeasonRecord[currentRecordField] !== 'object'
          || Array.isArray(currentSeasonRecord[currentRecordField]))
        throw new Error('과거 시즌 업적 정의와 진행 기록이 필요합니다.');
    }
    if (!Array.isArray(currentSeasonRecord.cpLedger) || !Array.isArray(currentSeasonRecord.spLedger))
      throw new Error('과거 시즌 CP·SP 지급 원장이 필요합니다.');
    for (const currentDefinitionRecord of Object.values(currentSeasonRecord.catalog)) {
      localizedAchievement(currentDefinitionRecord as AchievementDefinition, 'ko');
      localizedAchievement(currentDefinitionRecord as AchievementDefinition, 'en');
    }
  }
}
