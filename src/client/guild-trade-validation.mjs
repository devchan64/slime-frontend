function requireGuildResponseCondition(currentValidationResult) {
    if (!currentValidationResult)
        throw new Error('길드 거래 응답 형식이 올바르지 않습니다.');
}
function isGuildPositiveInteger(currentNumericValue) { return Number.isSafeInteger(currentNumericValue) && Number(currentNumericValue) > 0; }
export function parseGuildMaterialCatalog(currentResponseValue) {
    requireGuildResponseCondition(currentResponseValue && Number.isSafeInteger(currentResponseValue.characterVersion) && currentResponseValue.characterVersion >= 0
        && isGuildPositiveInteger(currentResponseValue.policyVersion) && isGuildPositiveInteger(currentResponseValue.maximumQuantity) && Array.isArray(currentResponseValue.items));
    const currentMaterialIdentifiers = new Set();
    for (const currentMaterialEntry of currentResponseValue.items) {
        requireGuildResponseCondition(currentMaterialEntry && typeof currentMaterialEntry.materialId === 'string' && currentMaterialEntry.materialId.length > 0 && !currentMaterialIdentifiers.has(currentMaterialEntry.materialId)
            && isGuildPositiveInteger(currentMaterialEntry.quantity) && isGuildPositiveInteger(currentMaterialEntry.unitPriceP)
            && typeof currentMaterialEntry.nameTranslations?.ko === 'string' && typeof currentMaterialEntry.nameTranslations?.en === 'string');
        currentMaterialIdentifiers.add(currentMaterialEntry.materialId);
    }
    return currentResponseValue;
}
export function parseGuildMaterialQuote(currentResponseValue, currentMaterialIdentifier, currentSaleQuantity) {
    requireGuildResponseCondition(currentResponseValue && Number.isSafeInteger(currentResponseValue.characterVersion) && currentResponseValue.characterVersion >= 0
        && isGuildPositiveInteger(currentResponseValue.policyVersion) && isGuildPositiveInteger(currentResponseValue.maximumQuantity)
        && currentResponseValue.materialId === currentMaterialIdentifier && currentResponseValue.quantity === currentSaleQuantity
        && isGuildPositiveInteger(currentResponseValue.unitPriceP) && isGuildPositiveInteger(currentResponseValue.totalPriceP)
        && currentSaleQuantity <= currentResponseValue.maximumQuantity && currentResponseValue.totalPriceP === currentSaleQuantity * currentResponseValue.unitPriceP);
    return currentResponseValue;
}
export function validateGuildSaleReceipt(currentReceiptValue, currentOriginalRequest, currentFacilityIdentifier) {
    requireGuildResponseCondition(currentReceiptValue && typeof currentReceiptValue.saleId === 'string' && /^[0-9a-f-]{36}$/i.test(currentReceiptValue.saleId)
        && currentReceiptValue.facilityId === currentFacilityIdentifier && Number.isFinite(currentReceiptValue.completedAt)
        && currentReceiptValue.totalPriceP === Number(currentOriginalRequest.quantity) * Number(currentOriginalRequest.unitPriceP));
    for (const currentFieldName of ['requestId', 'materialId', 'quantity', 'policyVersion', 'unitPriceP'])
        requireGuildResponseCondition(currentReceiptValue[currentFieldName] === currentOriginalRequest[currentFieldName]);
}
export function parseCitizenshipPriceQuote(currentResponseValue, currentCityIdentifier) {
    requireGuildResponseCondition(currentResponseValue && currentResponseValue.cityId === currentCityIdentifier && isGuildPositiveInteger(currentResponseValue.policyVersion)
        && isGuildPositiveInteger(currentResponseValue.priceP) && Number.isFinite(currentResponseValue.serverTime) && currentResponseValue.serverTime >= 0
        && Number.isFinite(currentResponseValue.expiresAt) && currentResponseValue.expiresAt > currentResponseValue.serverTime);
    return currentResponseValue;
}
export function validateCitizenshipPurchaseReceipt(currentReceiptValue, currentOriginalRequest, currentFacilityIdentifier, currentCityIdentifier) {
    requireGuildResponseCondition(currentReceiptValue && currentReceiptValue.requestId === currentOriginalRequest.requestId
        && currentReceiptValue.facilityId === currentFacilityIdentifier && currentReceiptValue.cityId === currentCityIdentifier
        && currentReceiptValue.policyVersion === currentOriginalRequest.policyVersion && currentReceiptValue.priceP === currentOriginalRequest.priceP
        && Number.isFinite(currentReceiptValue.issuedAt) && currentReceiptValue.citizenship?.cityId === currentCityIdentifier
        && currentReceiptValue.citizenship?.source === 'purchase' && Number.isFinite(currentReceiptValue.citizenship?.startsAt)
        && Number.isFinite(currentReceiptValue.citizenship?.expiresAt)
        && currentReceiptValue.citizenship.startsAt === currentReceiptValue.issuedAt
        && currentReceiptValue.citizenship.expiresAt > currentReceiptValue.citizenship.startsAt);
}
