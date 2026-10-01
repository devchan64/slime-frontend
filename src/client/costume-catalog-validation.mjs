const COSTUME_IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function requireCostumeRecord(currentRecordValue, currentExpectedKeys) {
    if (!currentRecordValue || typeof currentRecordValue !== 'object' || Array.isArray(currentRecordValue) || Object.keys(currentRecordValue).sort().join() !== [...currentExpectedKeys].sort().join())
        throw new Error('코스튬 응답 필드가 올바르지 않습니다.');
}
function requireCostumeTranslations(currentTranslationValue) {
    requireCostumeRecord(currentTranslationValue, ['ko', 'en']);
    if (Object.values(currentTranslationValue).some(currentTextValue => typeof currentTextValue !== 'string' || !currentTextValue.trim()))
        throw new Error('코스튬 번역이 올바르지 않습니다.');
}
export function parseCostumeCatalog(currentResponseValue) {
    requireCostumeRecord(currentResponseValue, ['version', 'defaultCostumeId', 'entries']);
    if (currentResponseValue.version !== 1 || typeof currentResponseValue.defaultCostumeId !== 'string' || !Array.isArray(currentResponseValue.entries) || !currentResponseValue.entries.length)
        throw new Error('코스튬 카탈로그가 올바르지 않습니다.');
    const currentCostumeIdentifiers = new Set();
    for (const currentCostumeEntry of currentResponseValue.entries) {
        requireCostumeRecord(currentCostumeEntry, ['costumeId', 'version', 'designId', 'designVersion', 'nameTranslations', 'descriptionTranslations']);
        if ([currentCostumeEntry.costumeId, currentCostumeEntry.designId].some(currentIdentifierValue => typeof currentIdentifierValue !== 'string' || !COSTUME_IDENTIFIER_PATTERN.test(currentIdentifierValue))
            || [currentCostumeEntry.version, currentCostumeEntry.designVersion].some(currentVersionValue => !Number.isSafeInteger(currentVersionValue) || currentVersionValue < 1)
            || currentCostumeIdentifiers.has(currentCostumeEntry.costumeId))
            throw new Error('코스튬 ID·버전이 올바르지 않습니다.');
        requireCostumeTranslations(currentCostumeEntry.nameTranslations);
        requireCostumeTranslations(currentCostumeEntry.descriptionTranslations);
        currentCostumeIdentifiers.add(currentCostumeEntry.costumeId);
    }
    if (!currentCostumeIdentifiers.has(currentResponseValue.defaultCostumeId))
        throw new Error('기본 코스튬 정의가 없습니다.');
    return currentResponseValue;
}
