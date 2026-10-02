// GUI와 텍스트가 공유하는 혼합 납부 선택 검증. 가치 평가는 서버가 담당한다.
export function validateTravelerBarterQuote(currentQuoteResponse,currentGuardEntry,currentSelectedPayment,currentQuoteValidator) {
  if(!currentQuoteResponse||!Object.hasOwn(currentQuoteResponse,'payment'))throw new Error('혼합 납부 견적이 없습니다.');
  const {payment:currentPaymentRecord,...currentBaseQuote}=currentQuoteResponse;
  currentQuoteValidator(currentBaseQuote,currentGuardEntry);
  const currentInvalidMessage='혼합 납부 견적 응답이 올바르지 않습니다.';
  if(!currentPaymentRecord||Object.keys(currentPaymentRecord).sort().join(',')!=='cashP,materials'
    ||!Number.isSafeInteger(currentPaymentRecord.cashP)||currentPaymentRecord.cashP<0
    ||currentPaymentRecord.cashP!==currentSelectedPayment.cashP||!currentPaymentRecord.materials||Array.isArray(currentPaymentRecord.materials)
    ||!Object.keys(currentPaymentRecord.materials).length
    ||Object.keys(currentPaymentRecord.materials).sort().join(',')!==Object.keys(currentSelectedPayment.materials).sort().join(','))throw new Error(currentInvalidMessage);
  for(const [currentMaterialIdentifier,currentMaterialQuantity] of Object.entries(currentSelectedPayment.materials)){
    if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(currentMaterialIdentifier)
      ||!Number.isSafeInteger(currentMaterialQuantity)||currentMaterialQuantity<1
      ||currentPaymentRecord.materials[currentMaterialIdentifier]!==currentMaterialQuantity)throw new Error(currentInvalidMessage);
  }
  return currentQuoteResponse;
}
