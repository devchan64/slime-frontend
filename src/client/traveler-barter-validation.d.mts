export type TravelerBarterSelection = {cashP:number;materials:Record<string,number>};
export type TravelerBarterPayment = TravelerBarterSelection;
export function validateTravelerBarterQuote<T>(currentQuoteResponse:T & {payment:TravelerBarterPayment},currentGuardEntry:any,currentSelectedPayment:TravelerBarterSelection,currentQuoteValidator:(currentQuote:T,currentGuard:any)=>unknown):T & {payment:TravelerBarterPayment};
