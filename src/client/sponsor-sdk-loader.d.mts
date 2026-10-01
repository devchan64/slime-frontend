export type CostumeSponsorshipProjection = {
  costumeId: string; serverTime: number;
  sponsorship: null | {sponsorshipId: string; version: number; endsAt: number;
    sponsorNameTranslations: Record<'ko'|'en',string>; messageTranslations: Record<'ko'|'en',string>};
};
export type CostumeSponsorSdk = Readonly<{
  version: number;
  mount(currentContainerElement: HTMLElement, currentResponseRecord: CostumeSponsorshipProjection,
    currentDisplayOptions: {locale:'ko'|'en'; requestStartedAt:number}): Readonly<{destroy():void}>;
}>;
export declare function loadSignedSponsorSdk(currentSignedEnvelope:unknown, currentTrustedPublicKey:string,
  currentServerTimestamp:number, currentScriptNonce?:string):Promise<CostumeSponsorSdk>;
