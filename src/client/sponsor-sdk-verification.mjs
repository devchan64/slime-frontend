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
  const currentManifestRecord = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(currentPayloadBytes));
  requireExactManifest(currentManifestRecord, SIGNED_MANIFEST_FIELDS);
  const currentEffectiveTimestamp = currentServerTimestamp + (performance.now() - currentVerificationStarted) / 1000;
  if (currentManifestRecord.purpose !== 'slime-sponsor-sdk'
      || !Number.isFinite(currentManifestRecord.issuedAt) || currentManifestRecord.issuedAt < 0
      || !Number.isFinite(currentManifestRecord.expiresAt) || currentManifestRecord.expiresAt <= currentManifestRecord.issuedAt
      || currentManifestRecord.expiresAt - currentManifestRecord.issuedAt > SIGNED_MANIFEST_MAXIMUM_LIFETIME
      || currentManifestRecord.issuedAt > currentEffectiveTimestamp || currentEffectiveTimestamp >= currentManifestRecord.expiresAt
      || !Number.isSafeInteger(currentManifestRecord.sdkVersion) || currentManifestRecord.sdkVersion < 1) throw new Error('SDK 서명의 용도·기간·버전이 올바르지 않습니다.');
  const currentAddressMatch = typeof currentManifestRecord.sdkUrl === 'string' && SDK_SCRIPT_ADDRESS_PATTERN.exec(currentManifestRecord.sdkUrl);
  if (!currentAddressMatch || Number(currentAddressMatch[1]) !== currentManifestRecord.sdkVersion
      || typeof currentManifestRecord.sdkIntegrity !== 'string' || !currentManifestRecord.sdkIntegrity.startsWith('sha256-')) throw new Error('SDK 경로·버전·SRI가 올바르지 않습니다.');
  const currentIntegrityBytes = decodeCanonicalBase64(currentManifestRecord.sdkIntegrity.slice(7), 32);
  if (currentIntegrityBytes.length !== 32 || encodeDigestHexadecimal(currentIntegrityBytes) !== currentAddressMatch[2]) throw new Error('SDK 경로 해시와 SRI가 일치하지 않습니다.');
  return Object.freeze({...currentManifestRecord});
}
