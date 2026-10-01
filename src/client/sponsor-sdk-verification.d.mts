export type VerifiedSponsorSdkManifest = Readonly<{
  purpose: 'slime-sponsor-sdk'; issuedAt: number; expiresAt: number;
  sdkVersion: number; sdkIntegrity: string; sdkUrl: string;
}>;
/** 공개키는 응답 외부의 신뢰된 배포 설정에서 전달한다. */
export declare function verifySponsorSdkManifest(currentEnvelopeValue: unknown, currentTrustedPublicKey: string, currentServerTimestamp: number): Promise<VerifiedSponsorSdkManifest>;
