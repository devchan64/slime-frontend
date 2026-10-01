export function validatePartyFormationReceipt(currentReceiptValue,currentRequestIdentifier,currentActionName,currentRemovedLoan){
  if(!currentReceiptValue||currentReceiptValue.requestId!==currentRequestIdentifier||currentReceiptValue.action!==currentActionName
    ||typeof currentReceiptValue.loanId!=='string'||!currentReceiptValue.loanId||!Array.isArray(currentReceiptValue.loanIds)
    ||currentReceiptValue.loanIds.length>3||currentReceiptValue.loanIds.some((currentLoanIdentifier)=>typeof currentLoanIdentifier!=='string'||!currentLoanIdentifier)
    ||new Set(currentReceiptValue.loanIds).size!==currentReceiptValue.loanIds.length||!Number.isFinite(currentReceiptValue.completedAt)
    ||(currentActionName==='REMOVE'&&(currentReceiptValue.loanId!==currentRemovedLoan||currentReceiptValue.loanIds.includes(currentRemovedLoan)))
    ||(currentActionName==='ADD'&&!currentReceiptValue.loanIds.includes(currentReceiptValue.loanId)))throw new Error('파티 편성 결과가 요청과 다릅니다.');
}
