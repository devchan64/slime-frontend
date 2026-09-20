export type PartyCandidateEntry={characterId:string;name:string;source:'USER';status:'AVAILABLE'|'ALREADY_BORROWED'|'CP_OUT_OF_RANGE'|'CAPACITY_FULL';cpEligible:boolean;remainingBorrowerSlots:number};
export type PartyCandidatePage={cityId:string;characterVersion:number;serverTime:number;entries:PartyCandidateEntry[];nextCursor:string|null};
export function parsePartyCandidatePage(currentResponseValue:any,currentCityIdentifier:string):PartyCandidatePage{
  if(!currentResponseValue||currentResponseValue.cityId!==currentCityIdentifier||!Number.isSafeInteger(currentResponseValue.characterVersion)||currentResponseValue.characterVersion<0
    ||!Number.isFinite(currentResponseValue.serverTime)||!Array.isArray(currentResponseValue.entries)||(currentResponseValue.nextCursor!==null&&typeof currentResponseValue.nextCursor!=='string'))throw new Error('파티 후보 목록 형식이 올바르지 않습니다.');
  const currentCandidateIdentifiers=new Set<string>();
  for(const currentCandidateEntry of currentResponseValue.entries){
    if(!currentCandidateEntry||typeof currentCandidateEntry.characterId!=='string'||!currentCandidateEntry.characterId||currentCandidateIdentifiers.has(currentCandidateEntry.characterId)
      ||typeof currentCandidateEntry.name!=='string'||!currentCandidateEntry.name.trim()||currentCandidateEntry.source!=='USER'
      ||!['AVAILABLE','ALREADY_BORROWED','CP_OUT_OF_RANGE','CAPACITY_FULL'].includes(currentCandidateEntry.status)||typeof currentCandidateEntry.cpEligible!=='boolean'
      ||!Number.isSafeInteger(currentCandidateEntry.remainingBorrowerSlots)||currentCandidateEntry.remainingBorrowerSlots<0||currentCandidateEntry.remainingBorrowerSlots>3)throw new Error('파티 후보 정보가 올바르지 않습니다.');
    currentCandidateIdentifiers.add(currentCandidateEntry.characterId);
  }
  return currentResponseValue;
}
export function validatePartyFormationReceipt(currentReceiptValue:any,currentRequestIdentifier:string,currentActionName:'ADD'|'REMOVE',currentRemovedLoan?:string){
  if(!currentReceiptValue||currentReceiptValue.requestId!==currentRequestIdentifier||currentReceiptValue.action!==currentActionName
    ||typeof currentReceiptValue.loanId!=='string'||!currentReceiptValue.loanId||!Array.isArray(currentReceiptValue.loanIds)
    ||currentReceiptValue.loanIds.length>3||currentReceiptValue.loanIds.some((currentLoanIdentifier:unknown)=>typeof currentLoanIdentifier!=='string'||!currentLoanIdentifier)
    ||new Set(currentReceiptValue.loanIds).size!==currentReceiptValue.loanIds.length||!Number.isFinite(currentReceiptValue.completedAt)
    ||(currentActionName==='REMOVE'&&(currentReceiptValue.loanId!==currentRemovedLoan||currentReceiptValue.loanIds.includes(currentRemovedLoan)))
    ||(currentActionName==='ADD'&&!currentReceiptValue.loanIds.includes(currentReceiptValue.loanId)))throw new Error('파티 편성 결과가 요청과 다릅니다.');
}
