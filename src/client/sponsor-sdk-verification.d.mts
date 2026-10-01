export type VerifiedSponsorSdkManifest = Readonly<{
  purpose: 'slime-sponsor-sdk'; issuedAt: number; expiresAt: number;
  sdkVersion: number; sdkIntegrity: string; sdkUrl: string;
}>;
/** 공개키는 응답 외부의 신뢰된 배포 설정에서 전달한다. */
export declare function verifySponsorSdkManifest(currentEnvelopeValue: unknown, currentTrustedPublicKey: string, currentServerTimestamp: number): Promise<VerifiedSponsorSdkManifest>;

export type CostumeDisplayContext = Readonly<{characterId:string; generation:number; epoch:number; room:string; costumeId:string}>;
export type VerifiedCostumeDisplaySession = CostumeDisplayContext & Readonly<{
  purpose:'slime-costume-display'; attemptId:string; nonce:string; sponsorshipId:string; adAssetVersion:number;
  issuedAt:number; expiresAt:number;
  sdk:Readonly<{sdkVersion:number; sdkIntegrity:string; sdkUrl:string}>;
  advertisement:Readonly<{costumeId:string; serverTime:number; sponsorship:Readonly<{
    sponsorshipId:string; version:number; endsAt:number;
    sponsorNameTranslations:Readonly<Record<'ko'|'en',string>>; messageTranslations:Readonly<Record<'ko'|'en',string>>;
  }>}>
}>;
/** 검증 후에도 화면은 최신 문맥을 다시 대조하고 문맥 변경 시 표시를 제거해야 한다. */
export declare function verifyCostumeDisplaySession(currentEnvelopeValue:unknown, currentTrustedPublicKey:string,
  currentServerTimestamp:number, currentExpectedContext:CostumeDisplayContext):Promise<VerifiedCostumeDisplaySession>;
