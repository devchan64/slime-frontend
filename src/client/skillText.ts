export type SkillText = { name: string; description: string };
export type SkillDefinition = SkillText & {
  id: string; icon: string; initial?: boolean;
  translations?: Record<"ko" | "en", SkillText>;
};

/** 번역 없는 이전 v1 정의는 원문을 보존하고 불완전한 새 계약은 거절한다. */
export function localizedSkill(definition: SkillDefinition, locale: "ko" | "en"): SkillDefinition {
  if (definition.translations === undefined) return definition;
  const pair = definition.translations;
  if (!pair || typeof pair !== "object" || Object.keys(pair).sort().join() !== "en,ko")
    throw new Error(`스킬 번역 언어가 올바르지 않습니다: ${definition.id}`);
  for (const text of Object.values(pair)) {
    if (!text || typeof text !== "object" || Object.keys(text).sort().join() !== "description,name"
        || typeof text.name !== "string" || !text.name.trim()
        || typeof text.description !== "string" || !text.description.trim())
      throw new Error(`스킬 번역이 누락되었습니다: ${definition.id}`);
  }
  return { ...definition, ...pair[locale] };
}
