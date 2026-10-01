const DISPLAY_SESSION_MAXIMUM_LIFETIME = 60;
const DISPLAY_CONTEXT_FIELD_NAMES = ['characterId', 'generation', 'epoch', 'room', 'costumeId'];
const DISPLAY_SESSION_FIELD_NAMES = ['purpose', 'attemptId', 'nonce', ...DISPLAY_CONTEXT_FIELD_NAMES,
  'sponsorshipId', 'adAssetVersion', 'issuedAt', 'expiresAt', 'sdk', 'advertisement'];
const DISPLAY_CONTENT_IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const DISPLAY_ATTEMPT_IDENTIFIER_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SIGNED_MANIFEST_MAXIMUM_BYTES = 4096;
const SIGNED_MANIFEST_MAXIMUM_LIFETIME = 300;
const SDK_SCRIPT_ADDRESS_PATTERN = /^\/v1\/sponsorship\/sdk\/([1-9][0-9]*)\/([a-f0-9]{64})\/costume\.js$/;
const SIGNATURE_ENVELOPE_FIELDS = ['algorithm', 'keyId', 'publicKey', 'payload', 'signature'];
const SIGNED_MANIFEST_FIELDS = ['purpose', 'issuedAt', 'expiresAt', 'sdkVersion', 'sdkIntegrity', 'sdkUrl'];
function requireExactManifest(currentRecordValue, currentExpectedFields) {
  if (!currentRecordValue || typeof currentRecordValue !== 'object' || Array.isArray(currentRecordValue)
      || Object.keys(currentRecordValue).sort().join() !== [...currentExpectedFields].sort().join()) throw new Error('SDK 서명 응답 필드가 올바르지 않습니다.');
}
function decodeCanonicalBase64(currentEncodedValue, currentMaximumBytes) {
  if (typeof currentEncodedValue !== 'string' || !currentEncodedValue.length || currentEncodedValue.length > Math.ceil(currentMaximumBytes / 3) * 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(currentEncodedValue)) throw new Error('SDK Base64 값이 올바르지 않습니다.');
  const currentDecodedText = atob(currentEncodedValue);
  if (btoa(currentDecodedText) !== currentEncodedValue || currentDecodedText.length > currentMaximumBytes) throw new Error('SDK Base64 정규형이 아닙니다.');
  return Uint8Array.from(currentDecodedText, currentByteCharacter => currentByteCharacter.charCodeAt(0));
}
function encodeDigestHexadecimal(currentDigestBytes) {
  return [...new Uint8Array(currentDigestBytes)].map(currentByteValue => currentByteValue.toString(16).padStart(2, '0')).join('');
}
export async function verifySponsorSdkManifest(currentEnvelopeValue, currentTrustedPublicKey, currentServerTimestamp) {
  const currentVerificationStarted = performance.now();
  if (!Number.isFinite(currentServerTimestamp) || currentServerTimestamp < 0) throw new Error('SDK 검증 기준 시각이 올바르지 않습니다.');
  const currentManifestRecord = await verifySponsorPayload(currentEnvelopeValue, currentTrustedPublicKey);
  requireExactManifest(currentManifestRecord, SIGNED_MANIFEST_FIELDS);
  const currentEffectiveTimestamp = currentServerTimestamp + (performance.now() - currentVerificationStarted) / 1000;
  requireSponsorValidity(currentManifestRecord, currentEffectiveTimestamp, SIGNED_MANIFEST_MAXIMUM_LIFETIME);
  if (currentManifestRecord.purpose !== 'slime-sponsor-sdk') throw new Error('SDK 서명의 용도가 올바르지 않습니다.');
  requireSponsorSdkIdentity(currentManifestRecord);
  return Object.freeze({...currentManifestRecord});
}
async function verifySponsorPayload(currentEnvelopeValue, currentTrustedPublicKey) {
  requireExactManifest(currentEnvelopeValue, SIGNATURE_ENVELOPE_FIELDS);
  // await 중 외부 응답 객체가 바뀌어도 검증 대상을 바꾸지 않는다.
  const currentEnvelopeRecord = Object.fromEntries(SIGNATURE_ENVELOPE_FIELDS.map(currentFieldName => [currentFieldName, currentEnvelopeValue[currentFieldName]]));
  if (currentEnvelopeRecord.algorithm !== 'Ed25519' || currentEnvelopeRecord.publicKey !== currentTrustedPublicKey) throw new Error('신뢰한 SDK 서명 키 또는 알고리즘이 아닙니다.');
  const currentPublicBytes = decodeCanonicalBase64(currentTrustedPublicKey, 32);
  const currentSignatureBytes = decodeCanonicalBase64(currentEnvelopeRecord.signature, 64);
  const currentPayloadBytes = decodeCanonicalBase64(currentEnvelopeRecord.payload, SIGNED_MANIFEST_MAXIMUM_BYTES);
  if (currentPublicBytes.length !== 32 || currentSignatureBytes.length !== 64) throw new Error('SDK 공개키·서명 길이가 올바르지 않습니다.');
  if (currentEnvelopeRecord.keyId !== encodeDigestHexadecimal(await crypto.subtle.digest('SHA-256', currentPublicBytes))) throw new Error('SDK 공개키 지문이 일치하지 않습니다.');
  const currentVerificationKey = await crypto.subtle.importKey('raw', currentPublicBytes, {name: 'Ed25519'}, false, ['verify']);
  if (!await crypto.subtle.verify('Ed25519', currentVerificationKey, currentSignatureBytes, currentPayloadBytes)) throw new Error('SDK 서버 서명이 올바르지 않습니다.');
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(currentPayloadBytes));
}
function requireSponsorValidity(currentManifestRecord, currentEffectiveTimestamp, currentMaximumLifetime) {
  if (!Number.isFinite(currentEffectiveTimestamp) || currentEffectiveTimestamp < 0
      || !Number.isFinite(currentManifestRecord.issuedAt) || currentManifestRecord.issuedAt < 0
      || !Number.isFinite(currentManifestRecord.expiresAt) || currentManifestRecord.expiresAt <= currentManifestRecord.issuedAt
      || currentManifestRecord.expiresAt - currentManifestRecord.issuedAt > currentMaximumLifetime
      || currentManifestRecord.issuedAt > currentEffectiveTimestamp || currentEffectiveTimestamp >= currentManifestRecord.expiresAt)
    throw new Error('광고 서명의 유효기간이 올바르지 않습니다.');
}
function requireSponsorSdkIdentity(currentManifestRecord) {
  if (!Number.isSafeInteger(currentManifestRecord.sdkVersion) || currentManifestRecord.sdkVersion < 1)
    throw new Error('SDK 버전이 올바르지 않습니다.');
  const currentAddressMatch = typeof currentManifestRecord.sdkUrl === 'string' && SDK_SCRIPT_ADDRESS_PATTERN.exec(currentManifestRecord.sdkUrl);
  if (!currentAddressMatch || Number(currentAddressMatch[1]) !== currentManifestRecord.sdkVersion
      || typeof currentManifestRecord.sdkIntegrity !== 'string' || !currentManifestRecord.sdkIntegrity.startsWith('sha256-')) throw new Error('SDK 경로·버전·SRI가 올바르지 않습니다.');
  const currentIntegrityBytes = decodeCanonicalBase64(currentManifestRecord.sdkIntegrity.slice(7), 32);
  if (currentIntegrityBytes.length !== 32 || encodeDigestHexadecimal(currentIntegrityBytes) !== currentAddressMatch[2]) throw new Error('SDK 경로 해시와 SRI가 일치하지 않습니다.');
}

function freezeSponsorRecord(currentRecordValue) {
  for (const currentNestedValue of Object.values(currentRecordValue)) {
    if (currentNestedValue && typeof currentNestedValue === 'object') freezeSponsorRecord(currentNestedValue);
  }
  return Object.freeze(currentRecordValue);
}
export async function verifyCostumeDisplaySession(currentEnvelopeValue, currentTrustedPublicKey, currentServerTimestamp, currentExpectedContext) {
  const currentVerificationStarted = performance.now();
  requireExactManifest(currentExpectedContext, DISPLAY_CONTEXT_FIELD_NAMES);
  const currentContextSnapshot = {...currentExpectedContext};
  if (!Number.isFinite(currentServerTimestamp) || currentServerTimestamp < 0) throw new Error('광고 검증 기준 시각이 올바르지 않습니다.');
  const currentSessionRecord = await verifySponsorPayload(currentEnvelopeValue, currentTrustedPublicKey);
  requireExactManifest(currentSessionRecord, DISPLAY_SESSION_FIELD_NAMES);
  requireSponsorValidity(currentSessionRecord, currentServerTimestamp + (performance.now() - currentVerificationStarted) / 1000, DISPLAY_SESSION_MAXIMUM_LIFETIME);
  if (currentSessionRecord.purpose !== 'slime-costume-display'
      || typeof currentSessionRecord.attemptId !== 'string' || !DISPLAY_ATTEMPT_IDENTIFIER_PATTERN.test(currentSessionRecord.attemptId)
      || typeof currentSessionRecord.nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(currentSessionRecord.nonce)
      || typeof currentSessionRecord.characterId !== 'string' || !currentSessionRecord.characterId
      || !Number.isSafeInteger(currentSessionRecord.generation) || currentSessionRecord.generation < 0
      || !Number.isSafeInteger(currentSessionRecord.epoch) || currentSessionRecord.epoch < 0
      || typeof currentSessionRecord.room !== 'string' || !/^(map|battle):[^\s:]+$/.test(currentSessionRecord.room)
      || DISPLAY_CONTEXT_FIELD_NAMES.some(currentFieldName => currentSessionRecord[currentFieldName] !== currentContextSnapshot[currentFieldName]))
    throw new Error('광고 표시 세션의 용도·접속 문맥이 일치하지 않습니다.');
  requireExactManifest(currentSessionRecord.sdk, ['sdkVersion', 'sdkIntegrity', 'sdkUrl']);
  requireSponsorSdkIdentity(currentSessionRecord.sdk);
  const currentAdvertisementRecord = currentSessionRecord.advertisement;
  requireExactManifest(currentAdvertisementRecord, ['costumeId', 'serverTime', 'sponsorship']);
  const currentSponsorshipRecord = currentAdvertisementRecord.sponsorship;
  requireExactManifest(currentSponsorshipRecord, ['sponsorshipId', 'version', 'endsAt', 'sponsorNameTranslations', 'messageTranslations']);
  if ([currentSessionRecord.costumeId, currentSessionRecord.sponsorshipId].some(currentIdentifierValue => typeof currentIdentifierValue !== 'string' || !DISPLAY_CONTENT_IDENTIFIER_PATTERN.test(currentIdentifierValue))
      || currentAdvertisementRecord.costumeId !== currentSessionRecord.costumeId
      || currentAdvertisementRecord.serverTime !== currentSessionRecord.issuedAt
      || currentSponsorshipRecord.sponsorshipId !== currentSessionRecord.sponsorshipId
      || !Number.isSafeInteger(currentSessionRecord.adAssetVersion) || currentSessionRecord.adAssetVersion < 1
      || currentSponsorshipRecord.version !== currentSessionRecord.adAssetVersion
      || !Number.isFinite(currentSponsorshipRecord.endsAt) || currentSessionRecord.expiresAt > currentSponsorshipRecord.endsAt)
    throw new Error('광고 표시 세션의 소재·기간이 일치하지 않습니다.');
  for (const currentTranslationRecord of [currentSponsorshipRecord.sponsorNameTranslations, currentSponsorshipRecord.messageTranslations]) {
    requireExactManifest(currentTranslationRecord, ['ko', 'en']);
    if (Object.values(currentTranslationRecord).some(currentTextValue => typeof currentTextValue !== 'string' || !currentTextValue.trim()))
      throw new Error('광고 번역이 올바르지 않습니다.');
  }
  // SDK 자체의 제거 타이머도 서명 세션의 만료 시각을 넘을 수 없다.
  currentSponsorshipRecord.endsAt = currentSessionRecord.expiresAt;
  return freezeSponsorRecord(currentSessionRecord);
}
