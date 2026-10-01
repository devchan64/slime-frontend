const JOURNAL_INVALID_MESSAGE = '의뢰 기록 응답이 올바르지 않습니다.';
const validJournalText = (currentTextValue) => typeof currentTextValue === 'string' && !!currentTextValue.trim();
const validJournalNumber = (currentNumberValue) => typeof currentNumberValue === 'number' && Number.isFinite(currentNumberValue) && currentNumberValue >= 0;
function validateJournalRecord(currentRecordValue, expectedRecordKeys) {
    if (!currentRecordValue || typeof currentRecordValue !== 'object' || Array.isArray(currentRecordValue)
        || Object.keys(currentRecordValue).length !== expectedRecordKeys.length || expectedRecordKeys.some(currentRecordKey => !Object.hasOwn(currentRecordValue, currentRecordKey)))
        throw new Error(JOURNAL_INVALID_MESSAGE);
}
export function parseMainEventJournal(currentResponseValue) {
    const currentCapacityPresent = !!currentResponseValue && typeof currentResponseValue === 'object'
        && (Object.hasOwn(currentResponseValue, 'acceptedCount') || Object.hasOwn(currentResponseValue, 'maximumAcceptedCount'));
    validateJournalRecord(currentResponseValue, ['serverTime', 'characterVersion', 'entries',
        ...(currentCapacityPresent ? ['acceptedCount', 'maximumAcceptedCount'] : [])]);
    if (currentCapacityPresent && (!Number.isSafeInteger(currentResponseValue.acceptedCount) || currentResponseValue.acceptedCount < 0
        || !Number.isSafeInteger(currentResponseValue.maximumAcceptedCount) || currentResponseValue.maximumAcceptedCount < 1))
        throw new Error(JOURNAL_INVALID_MESSAGE);
    if (!validJournalNumber(currentResponseValue.serverTime) || !Number.isSafeInteger(currentResponseValue.characterVersion)
        || currentResponseValue.characterVersion < 0 || !Array.isArray(currentResponseValue.entries))
        throw new Error(JOURNAL_INVALID_MESSAGE);
    const observedEventIdentifiers = new Set();
    for (const currentJournalEntry of currentResponseValue.entries) {
        validateJournalRecord(currentJournalEntry, ['eventId', 'title', 'acceptedAt', 'completedAt', 'moneyP', 'status', 'materialsSufficient', 'giver', 'receiver', 'items']);
        if (!validJournalText(currentJournalEntry.eventId) || observedEventIdentifiers.has(currentJournalEntry.eventId) || !validJournalText(currentJournalEntry.title)
            || !validJournalNumber(currentJournalEntry.acceptedAt) || !Number.isSafeInteger(currentJournalEntry.moneyP) || currentJournalEntry.moneyP < 1
            || !['ACCEPTED', 'COMPLETED'].includes(currentJournalEntry.status) || typeof currentJournalEntry.materialsSufficient !== 'boolean'
            || !Array.isArray(currentJournalEntry.items) || !currentJournalEntry.items.length
            || (currentJournalEntry.status === 'ACCEPTED' ? currentJournalEntry.completedAt !== null
                : !validJournalNumber(currentJournalEntry.completedAt) || currentJournalEntry.completedAt < currentJournalEntry.acceptedAt))
            throw new Error(JOURNAL_INVALID_MESSAGE);
        observedEventIdentifiers.add(currentJournalEntry.eventId);
        for (const currentNpcRecord of [currentJournalEntry.giver, currentJournalEntry.receiver]) {
            validateJournalRecord(currentNpcRecord, ['id', 'name', 'cityId', 'facilityId']);
            if (!Object.values(currentNpcRecord).every(validJournalText))
                throw new Error(JOURNAL_INVALID_MESSAGE);
        }
        const observedMaterialIdentifiers = new Set();
        for (const currentMaterialItem of currentJournalEntry.items) {
            validateJournalRecord(currentMaterialItem, ['itemId', 'required', 'owned', 'nameTranslations']);
            validateJournalRecord(currentMaterialItem.nameTranslations, ['ko', 'en']);
            if (!validJournalText(currentMaterialItem.itemId) || observedMaterialIdentifiers.has(currentMaterialItem.itemId)
                || !Number.isSafeInteger(currentMaterialItem.required) || currentMaterialItem.required < 1
                || !Number.isSafeInteger(currentMaterialItem.owned) || currentMaterialItem.owned < 0
                || !Object.values(currentMaterialItem.nameTranslations).every(validJournalText))
                throw new Error(JOURNAL_INVALID_MESSAGE);
            observedMaterialIdentifiers.add(currentMaterialItem.itemId);
        }
        if (currentJournalEntry.materialsSufficient !== (currentJournalEntry.status === 'ACCEPTED'
            && currentJournalEntry.items.every((currentMaterialItem) => currentMaterialItem.owned >= currentMaterialItem.required)))
            throw new Error(JOURNAL_INVALID_MESSAGE);
    }
    return currentResponseValue;
}
