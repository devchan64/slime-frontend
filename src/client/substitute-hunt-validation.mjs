function requireHuntResponse(currentResponseCondition) {
  if (!currentResponseCondition) throw new Error("\uB300\uCCB4 \uC0AC\uB0E5 \uC751\uB2F5 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
}
function isHuntRecord(currentResponseValue) {
  return !!currentResponseValue && typeof currentResponseValue === "object" && !Array.isArray(currentResponseValue);
}
function isHuntInteger(currentResponseValue, currentMinimumValue = 0) {
  return typeof currentResponseValue === "number" && Number.isSafeInteger(currentResponseValue) && currentResponseValue >= currentMinimumValue;
}
function isHuntIdentifier(currentResponseValue) {
  return typeof currentResponseValue === "string" && /^[a-z][a-z0-9-]*$/.test(currentResponseValue);
}
function validateHuntQuote(currentResponseValue) {
  requireHuntResponse(isHuntRecord(currentResponseValue));
  for (const currentVersionField of ["policyVersion", "encounterCatalogVersion", "monsterReferenceVersion"]) requireHuntResponse(isHuntInteger(currentResponseValue[currentVersionField], 1));
  requireHuntResponse(isHuntIdentifier(currentResponseValue.encounterId) && isHuntIdentifier(currentResponseValue.speciesId));
  requireHuntResponse(isHuntInteger(currentResponseValue.csp, 1) && isHuntInteger(currentResponseValue.enemyCount, 1) && isHuntInteger(currentResponseValue.fpCost, 1));
  requireHuntResponse(currentResponseValue.fpCost === currentResponseValue.csp * currentResponseValue.enemyCount);
}
function parseSubstituteHuntCatalog(currentResponseValue) {
  requireHuntResponse(isHuntRecord(currentResponseValue) && isHuntInteger(currentResponseValue.characterVersion) && isHuntInteger(currentResponseValue.fp, -Number.MAX_SAFE_INTEGER) && currentResponseValue.fp <= 1e3 && Array.isArray(currentResponseValue.encounters));
  const currentEncounterIdentifiers = /* @__PURE__ */ new Set();
  for (const currentEntryValue of currentResponseValue.encounters) {
    requireHuntResponse(isHuntRecord(currentEntryValue));
    validateHuntQuote(currentEntryValue);
    requireHuntResponse(!currentEncounterIdentifiers.has(currentEntryValue.encounterId));
    currentEncounterIdentifiers.add(currentEntryValue.encounterId);
    const currentEntryRecord = currentEntryValue;
    requireHuntResponse(currentEntryRecord.skillVariantId === null || isHuntIdentifier(currentEntryRecord.skillVariantId));
    requireHuntResponse(isHuntRecord(currentEntryRecord.nameTranslations) && ["ko", "en"].every((currentLocaleCode) => typeof currentEntryRecord.nameTranslations[currentLocaleCode] === "string" && currentEntryRecord.nameTranslations[currentLocaleCode].trim()));
    requireHuntResponse(typeof currentEntryRecord.eligible === "boolean" && typeof currentEntryRecord.available === "boolean");
    requireHuntResponse([null, "INVALID_STATE", "FIRST_HUNT_REQUIRED", "INSUFFICIENT_FP"].includes(currentEntryRecord.unavailableReason));
    requireHuntResponse(currentEntryRecord.available === (currentEntryRecord.unavailableReason === null));
    requireHuntResponse(!currentEntryRecord.available || currentEntryRecord.eligible && currentResponseValue.fp >= currentEntryValue.fpCost);
  }
  return currentResponseValue;
}
function parseSubstituteHuntReceipt(currentResponseValue, currentRequestIdentifier, currentEncounterIdentifier) {
  requireHuntResponse(isHuntRecord(currentResponseValue) && currentResponseValue.ok === true && currentResponseValue.kind === "substitute_hunt" && currentResponseValue.requestId === currentRequestIdentifier);
  const currentResultValue = currentResponseValue.substituteHunt;
  requireHuntResponse(isHuntRecord(currentResultValue));
  validateHuntQuote(currentResultValue);
  const currentResultRecord = currentResultValue;
  requireHuntResponse(currentResultValue.encounterId === currentEncounterIdentifier && currentResultRecord.fpConsumed === currentResultValue.fpCost && isHuntInteger(currentResultRecord.fpRemaining) && Number(currentResultRecord.fpRemaining) <= 1e3);
  for (const currentResultField of ["dropCatalogVersion", "dissectionPolicyVersion", "characterVersion"]) requireHuntResponse(isHuntInteger(currentResultRecord[currentResultField], 1));
  requireHuntResponse(Array.isArray(currentResultRecord.materials));
  for (const currentMaterialEntry of currentResultRecord.materials) requireHuntResponse(isHuntRecord(currentMaterialEntry) && isHuntIdentifier(currentMaterialEntry.materialId) && isHuntInteger(currentMaterialEntry.quantity, 1));
  return currentResponseValue;
}
export {
  parseSubstituteHuntCatalog,
  parseSubstituteHuntReceipt
};
