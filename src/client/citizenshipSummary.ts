export type CitizenshipRecord={cityId:string;cityName:string;source:'initial'|'purchase';startsAt:number;expiresAt:number;status:'PENDING'|'VALID'|'EXPIRED'};
export type CitizenshipSummary={records:CitizenshipRecord[]};
export {validateCitizenshipSummary} from './citizenship-summary-validation.mjs';
