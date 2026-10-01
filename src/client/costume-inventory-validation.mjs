import { parseCostumeCatalog } from "./costume-catalog-validation.mjs";
function parseCostumeInventory(currentResponseValue) {
  if (!currentResponseValue || typeof currentResponseValue !== "object" || Array.isArray(currentResponseValue) || Object.keys(currentResponseValue).sort().join(",") !== "characterVersion,defaultCostumeId,entries") throw new Error("\uCF54\uC2A4\uD2AC \uC18C\uC720 \uBAA9\uB85D \uD544\uB4DC\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const currentResponseRecord = currentResponseValue;
  if (!Number.isSafeInteger(currentResponseRecord.characterVersion) || currentResponseRecord.characterVersion < 0 || typeof currentResponseRecord.defaultCostumeId !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(currentResponseRecord.defaultCostumeId) || !Array.isArray(currentResponseRecord.entries)) throw new Error("\uCF54\uC2A4\uD2AC \uC18C\uC720 \uBAA9\uB85D\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const currentSeenIdentifiers = /* @__PURE__ */ new Set();
  for (const currentOwnedEntry of currentResponseRecord.entries) {
    if (!currentOwnedEntry || typeof currentOwnedEntry !== "object" || Array.isArray(currentOwnedEntry)) throw new Error("\uCF54\uC2A4\uD2AC \uC18C\uC720 \uD56D\uBAA9\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    const { valueP: currentValuePoints, source: currentSourceKind, acquiredAt: currentAcquiredTime, ...currentDefinitionRecord } = currentOwnedEntry;
    parseCostumeCatalog({ version: 2, defaultCostumeId: currentDefinitionRecord.costumeId, entries: [{ ...currentDefinitionRecord, valueP: currentValuePoints }] });
    if (!Number.isSafeInteger(currentValuePoints) || currentValuePoints < 1 || currentSourceKind !== "parcel" && currentSourceKind !== "shop" || !Number.isFinite(currentAcquiredTime) || currentAcquiredTime < 0 || !Number.isFinite(new Date(currentAcquiredTime * 1e3).getTime()) || currentSeenIdentifiers.has(currentDefinitionRecord.costumeId)) throw new Error("\uCF54\uC2A4\uD2AC \uD68D\uB4DD \uAE30\uB85D\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    currentSeenIdentifiers.add(currentDefinitionRecord.costumeId);
  }
  return currentResponseRecord;
}
export {
  parseCostumeInventory
};
