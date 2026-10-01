export {BORROWED_EXCLUSION_LABELS,parseBorrowedParticipation} from './borrowed-participation-validation.mjs';
import {BORROWED_EXCLUSION_LABELS} from './borrowed-participation-validation.mjs';
export type BorrowedExclusion = {loanId:string;name:string;reason:keyof typeof BORROWED_EXCLUSION_LABELS};
export type BorrowedParticipation = {serverTime:number;participants:{loanId:string;name:string}[];excluded:BorrowedExclusion[]};
