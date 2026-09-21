export type SkillText = { name: string; description: string };
export type SkillActionProgression = {
  actionId: string; name: string; requiredLevel: number; apCost: number;
  powerBasisPoints: number; requiredEquipment: 'one_handed_sword';
};
export type SkillDefinition = SkillText & {
  id: string; icon: string; initial?: boolean;
  actions?: SkillActionProgression[];
  translations?: Record<"ko" | "en", SkillText>;
};

/** 번역 없는 이전 v1 정의는 원문을 보존하고 불완전한 새 계약은 거절한다. */
export function localizedSkill(definition: SkillDefinition, locale: "ko" | "en"): SkillDefinition {
  if (definition.actions !== undefined) {
    if (!Array.isArray(definition.actions)) throw new Error(`스킬 액션 목록이 올바르지 않습니다: ${definition.id}`);
    const currentActionIdentifiers = new Set<string>();
    for (const currentActionDefinition of definition.actions) {
      if (!currentActionDefinition || typeof currentActionDefinition.actionId !== 'string' || !currentActionDefinition.actionId.trim()
          || typeof currentActionDefinition.name !== 'string' || !currentActionDefinition.name.trim()
          || currentActionDefinition.requiredEquipment !== 'one_handed_sword'
          || ![currentActionDefinition.requiredLevel,currentActionDefinition.apCost,currentActionDefinition.powerBasisPoints]
            .every(currentPositiveInteger => Number.isSafeInteger(currentPositiveInteger) && currentPositiveInteger > 0)
          || currentActionIdentifiers.has(currentActionDefinition.actionId))
        throw new Error(`스킬 액션 정의가 올바르지 않습니다: ${definition.id}`);
      currentActionIdentifiers.add(currentActionDefinition.actionId);
    }
  }
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
