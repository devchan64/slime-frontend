import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, randomUUID, randomBytes, sign} from 'node:crypto';
import {verifyCostumeDisplaySession, verifySponsorSdkManifest} from '../src/client/sponsor-sdk-verification.mjs';
const currentSigningKeys = generateKeyPairSync('ed25519');
const currentPublicBytes = currentSigningKeys.publicKey.export({format:'der',type:'spki'}).subarray(-32);
const currentTrustedKey = currentPublicBytes.toString('base64');
const currentScriptDigest = createHash('sha256').update('SDK test').digest();
const currentExpectedContext = {characterId:randomUUID(),generation:1,epoch:2,room:'map:'+randomUUID(),costumeId:'default'};
function createDisplayPayload() {
  return {purpose:'slime-costume-display',attemptId:randomUUID(),nonce:randomBytes(32).toString('base64url'),
    ...currentExpectedContext,sponsorshipId:'example',adAssetVersion:1,issuedAt:100,expiresAt:160,
    sdk:{sdkVersion:1,sdkIntegrity:'sha256-'+currentScriptDigest.toString('base64'),sdkUrl:'/v1/sponsorship/sdk/1/'+currentScriptDigest.toString('hex')+'/costume.js'},
    advertisement:{costumeId:'default',serverTime:100,sponsorship:{sponsorshipId:'example',version:1,endsAt:500,
      sponsorNameTranslations:{ko:'테스트',en:'Test'},messageTranslations:{ko:'광고 문구',en:'Advertisement'}}}};
}
function signDisplayPayload(currentPayloadRecord) {
  const currentPayloadBytes = Buffer.from(JSON.stringify(currentPayloadRecord));
  return {algorithm:'Ed25519',keyId:createHash('sha256').update(currentPublicBytes).digest('hex'),publicKey:currentTrustedKey,
    payload:currentPayloadBytes.toString('base64'),signature:sign(null,currentPayloadBytes,currentSigningKeys.privateKey).toString('base64')};
}
test('서명된 문맥과 광고를 검사하고 SDK 표시 종료를 세션 만료로 제한한다',async()=>{
  const currentPayloadRecord = createDisplayPayload();
  const currentVerifiedSession = await verifyCostumeDisplaySession(signDisplayPayload(currentPayloadRecord),currentTrustedKey,100,currentExpectedContext);
  assert.equal(currentVerifiedSession.advertisement.sponsorship.endsAt,160);
  assert.equal(currentPayloadRecord.advertisement.sponsorship.endsAt,500);
  assert.ok(Object.isFrozen(currentVerifiedSession));
  assert.ok(Object.isFrozen(currentVerifiedSession.sdk));
  assert.ok(Object.isFrozen(currentVerifiedSession.advertisement.sponsorship.messageTranslations));
  assert.throws(()=>currentVerifiedSession.advertisement.sponsorship.endsAt=500,TypeError);
});
test('다른 캐릭터·접속 세대·공간·코스튬의 세션을 거절한다',async()=>{
  for (const [currentFieldName,currentFieldValue] of Object.entries({characterId:randomUUID(),generation:2,epoch:3,room:'battle:elsewhere',costumeId:'other'})) {
    await assert.rejects(verifyCostumeDisplaySession(signDisplayPayload(createDisplayPayload()),currentTrustedKey,100,{...currentExpectedContext,[currentFieldName]:currentFieldValue}));
  }
});
test('서명된 응답도 잘못된 목적·수명·소재·SDK·번역이면 거절한다',async()=>{
  const currentPayloadMutations = [
    currentPayloadRecord=>currentPayloadRecord.purpose='slime-sponsor-sdk',
    currentPayloadRecord=>currentPayloadRecord.expiresAt=161,
    currentPayloadRecord=>currentPayloadRecord.issuedAt=101,
    currentPayloadRecord=>currentPayloadRecord.nonce='short',
    currentPayloadRecord=>currentPayloadRecord.attemptId='invalid',
    currentPayloadRecord=>currentPayloadRecord.adAssetVersion=true,
    currentPayloadRecord=>currentPayloadRecord.advertisement.costumeId='other',
    currentPayloadRecord=>currentPayloadRecord.advertisement.serverTime=99,
    currentPayloadRecord=>currentPayloadRecord.advertisement.sponsorship.version=2,
    currentPayloadRecord=>currentPayloadRecord.advertisement.sponsorship.sponsorshipId='other',
    currentPayloadRecord=>currentPayloadRecord.advertisement.sponsorship.endsAt=159,
    currentPayloadRecord=>currentPayloadRecord.advertisement.sponsorship.messageTranslations.ko=' ',
    currentPayloadRecord=>currentPayloadRecord.advertisement.sponsorship.sponsorNameTranslations.extra='extra',
    currentPayloadRecord=>currentPayloadRecord.sdk.sdkUrl='https://example.com/sdk.js',
    currentPayloadRecord=>currentPayloadRecord.sdk.sdkVersion=2,
    currentPayloadRecord=>currentPayloadRecord.advertisement.sponsorship=null,
    currentPayloadRecord=>currentPayloadRecord.extra=true,
  ];
  for (const mutateDisplayPayload of currentPayloadMutations) {
    const currentPayloadRecord=createDisplayPayload(); mutateDisplayPayload(currentPayloadRecord);
    await assert.rejects(verifyCostumeDisplaySession(signDisplayPayload(currentPayloadRecord),currentTrustedKey,100,currentExpectedContext));
  }
  await assert.rejects(verifyCostumeDisplaySession(signDisplayPayload(createDisplayPayload()),currentTrustedKey,160,currentExpectedContext));
  await assert.rejects(verifyCostumeDisplaySession(signDisplayPayload(createDisplayPayload()),currentTrustedKey,NaN,currentExpectedContext));
});
test('서명 변조·신뢰 키 교체·SDK manifest와 세션의 교차 사용을 거절한다',async()=>{
  const currentSignedEnvelope=signDisplayPayload(createDisplayPayload());
  await assert.rejects(verifyCostumeDisplaySession({...currentSignedEnvelope,signature:Buffer.alloc(64).toString('base64')},currentTrustedKey,100,currentExpectedContext));
  await assert.rejects(verifyCostumeDisplaySession(currentSignedEnvelope,Buffer.alloc(32).toString('base64'),100,currentExpectedContext));
  await assert.rejects(verifySponsorSdkManifest(currentSignedEnvelope,currentTrustedKey,100));
  const currentSdkManifest={purpose:'slime-sponsor-sdk',issuedAt:100,expiresAt:160,...createDisplayPayload().sdk};
  await assert.rejects(verifyCostumeDisplaySession(signDisplayPayload(currentSdkManifest),currentTrustedKey,100,currentExpectedContext));
});
test('비동기 서명 검증 도중 호출자 문맥 변경으로 다른 세션을 채택하지 않는다',async()=>{
  const currentMutableContext={...currentExpectedContext,room:'map:wrong'};
  const currentVerificationPromise=verifyCostumeDisplaySession(signDisplayPayload(createDisplayPayload()),currentTrustedKey,100,currentMutableContext);
  currentMutableContext.room=currentExpectedContext.room;
  await assert.rejects(currentVerificationPromise);
});
