export type PartyCandidateEntry={characterId:string;name:string;source:'USER'|'GUILD';status:'AVAILABLE'|'ALREADY_BORROWED'|'CP_OUT_OF_RANGE'|'CAPACITY_FULL';cpEligible:boolean;remainingBorrowerSlots:number};
export type PartyCandidatePage={cityId:string;characterVersion:number;serverTime:number;entries:PartyCandidateEntry[];nextCursor:string|null};
export {parsePartyCandidatePage} from './party-candidate-validation.mjs';
export {validatePartyFormationReceipt} from './party-formation-receipt.mjs';
