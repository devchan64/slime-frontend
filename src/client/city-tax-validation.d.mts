export type CityTaxPage = {
 version:1; policyVersion:2; startsAt:number; expiresAt:number; evaluatedAt:number; observedAt:number;
 timezone:'Asia/Seoul'; refreshHour:4;
 entries:{cityId:string;cityName:string;paidCitizenshipCount:number;taxBasisPoints:number}[];
};
export declare function parseCityTaxResponse(currentResponseValue:unknown):CityTaxPage;
