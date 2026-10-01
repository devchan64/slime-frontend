// GUI와 텍스트가 공유하는 혼합 납부 선택·합계 검증.
export function validateTravelerBarterQuote(currentQuoteResponse,currentGuardEntry,currentSelectedPayment,currentQuoteValidator) {
  if(!currentQuoteResponse||!Object.hasOwn(currentQuoteResponse,'payment'))throw new Error('혼합 납부 견적이 없습니다.');
  const {payment:currentPaymentRecord,...currentBaseQuote}=currentQuoteResponse;
  currentQuoteValidator(currentBaseQuote,currentGuardEntry);
  const currentInvalidMessage='혼합 납부 견적 응답이 올바르지 않습니다.';
  if(!currentPaymentRecord||Object.keys(currentPaymentRecord).sort().join(',')!=='cashP,excessValueP,materialValues,materials,totalValueP'
    ||currentPaymentRecord.cashP!==currentSelectedPayment.cashP||!currentPaymentRecord.materials||!currentPaymentRecord.materialValues
    ||Object.keys(currentPaymentRecord.materials).sort().join(',')!==Object.keys(currentSelectedPayment.materials).sort().join(',')
    ||Object.keys(currentPaymentRecord.materialValues).sort().join(',')!==Object.keys(currentSelectedPayment.materials).sort().join(','))throw new Error(currentInvalidMessage);
  let currentTotalValue=currentPaymentRecord.cashP;
  for(const [currentMaterialIdentifier,currentMaterialQuantity] of Object.entries(currentSelectedPayment.materials)){
    const currentStandardValue=currentPaymentRecord.materialValues[currentMaterialIdentifier];
    if(currentPaymentRecord.materials[currentMaterialIdentifier]!==currentMaterialQuantity||!Number.isSafeInteger(currentStandardValue)||currentStandardValue<1)throw new Error(currentInvalidMessage);
    currentTotalValue+=currentMaterialQuantity*currentStandardValue;
  }
  if(!Number.isSafeInteger(currentTotalValue)||currentTotalValue<currentBaseQuote.priceP||currentPaymentRecord.totalValueP!==currentTotalValue||currentPaymentRecord.excessValueP!==currentTotalValue-currentBaseQuote.priceP)throw new Error(currentInvalidMessage);
  return currentQuoteResponse;
}
