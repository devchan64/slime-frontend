function parseSkillbookInventory(currentResponseValue) {
  const currentBookResponse = currentResponseValue;
  if (!currentBookResponse || !Number.isSafeInteger(currentBookResponse.characterVersion) || currentBookResponse.characterVersion < 0 || !Array.isArray(currentBookResponse.books) || currentBookResponse.catalog !== void 0 && !Array.isArray(currentBookResponse.catalog)) throw new Error("\uC2A4\uD0AC\uBD81 \uBAA9\uB85D \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  for (const currentEntryCollection of [currentBookResponse.books, currentBookResponse.catalog ?? []]) {
    const currentBookIdentifiers = /* @__PURE__ */ new Set();
    for (const currentBookEntry of currentEntryCollection) {
      if (!currentBookEntry || typeof currentBookEntry.definitionId !== "string" || !currentBookEntry.definitionId || currentBookIdentifiers.has(currentBookEntry.definitionId) || ![currentBookEntry.definitionVersion, currentBookEntry.literacyRequired].every((currentNumericValue) => Number.isSafeInteger(currentNumericValue) && currentNumericValue >= 1) || !Number.isSafeInteger(currentBookEntry.priceP) || currentBookEntry.priceP < (currentEntryCollection === currentBookResponse.books ? 0 : 1) || typeof currentBookEntry.grantsSkill !== "string" || !currentBookEntry.grantsSkill || !currentBookEntry.nameTranslations?.ko || !currentBookEntry.nameTranslations?.en || typeof currentBookEntry.nameTranslations.ko !== "string" || typeof currentBookEntry.nameTranslations.en !== "string") throw new Error("\uC2A4\uD0AC\uBD81 \uC815\uC758 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      currentBookIdentifiers.add(currentBookEntry.definitionId);
    }
  }
  for (const currentBookEntry of currentBookResponse.books) {
    if (typeof currentBookEntry.requestId !== "string" || !currentBookEntry.requestId || typeof currentBookEntry.facilityId !== "string" || !currentBookEntry.facilityId || !Number.isFinite(currentBookEntry.purchasedAt) || currentBookEntry.purchasedAt < 0 || !(currentBookEntry.firstReadAt === null || Number.isFinite(currentBookEntry.firstReadAt) && currentBookEntry.firstReadAt >= currentBookEntry.purchasedAt) || !Number.isSafeInteger(currentBookEntry.weightG) || currentBookEntry.weightG < 0) throw new Error("\uC2A4\uD0AC\uBD81 \uC18C\uC720 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  for (const currentBookEntry of currentBookResponse.catalog ?? []) {
    if (typeof currentBookEntry.owned !== "boolean" || currentBookEntry.owned !== currentBookResponse.books.some((currentOwnedEntry) => currentOwnedEntry.definitionId === currentBookEntry.definitionId)) throw new Error("\uC2A4\uD0AC\uBD81 \uC18C\uC720 \uC5EC\uBD80\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  return currentBookResponse;
}
export {
  parseSkillbookInventory
};
