import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {verifySponsorSdkManifest} from '../src/client/sponsor-sdk-verification.mjs';
const currentKeyPair=generateKeyPairSync('ed25519');
const currentPublicBytes=currentKeyPair.publicKey.export({format:'der',type:'spki'}).subarray(-32);
const currentTrustedPublicKey=currentPublicBytes.toString('base64');
const currentScriptHash=createHash('sha256').update('test SDK').digest();
function createSignedManifest(currentPayloadChanges={}){
 const currentPayloadRecord={purpose:'slime-sponsor-sdk',issuedAt:100,expiresAt:400,sdkVersion:1,sdkIntegrity:'sha256-'+currentScriptHash.toString('base64'),sdkUrl:'/v1/sponsorship/sdk/1/'+currentScriptHash.toString('hex')+'/costume.js',...currentPayloadChanges};
 const currentPayloadBytes=Buffer.from(JSON.stringify(currentPayloadRecord));
 return {algorithm:'Ed25519',keyId:createHash('sha256').update(currentPublicBytes).digest('hex'),publicKey:currentTrustedPublicKey,payload:currentPayloadBytes.toString('base64'),signature:sign(null,currentPayloadBytes,currentKeyPair.privateKey).toString('base64')};
}
test('신뢰 키·서명·해시가 일치하는 SDK 정보만 불변 사본으로 반환한다',async()=>{
 const currentVerifiedManifest=await verifySponsorSdkManifest(createSignedManifest(),currentTrustedPublicKey,100);
 assert.equal(currentVerifiedManifest.sdkVersion,1);assert.ok(Object.isFrozen(currentVerifiedManifest));
});
test('응답 키 교체·서명 변조·지문·알고리즘·Base64 오류를 거절한다',async()=>{
 for(const mutateSignedEnvelope of [currentEnvelopeRecord=>currentEnvelopeRecord.publicKey=Buffer.alloc(32).toString('base64'),currentEnvelopeRecord=>currentEnvelopeRecord.signature=Buffer.alloc(64).toString('base64'),currentEnvelopeRecord=>currentEnvelopeRecord.keyId='wrong',currentEnvelopeRecord=>currentEnvelopeRecord.algorithm='none',currentEnvelopeRecord=>currentEnvelopeRecord.payload+='\n',currentEnvelopeRecord=>currentEnvelopeRecord.extra=true]){
  const currentEnvelopeRecord=createSignedManifest();mutateSignedEnvelope(currentEnvelopeRecord);await assert.rejects(verifySponsorSdkManifest(currentEnvelopeRecord,currentTrustedPublicKey,100));
 }
 await assert.rejects(verifySponsorSdkManifest(createSignedManifest(),'',100));
});
test('유효한 서명도 잘못된 목적·시각·수명·버전·외부 경로·해시이면 거절한다',async()=>{
 for(const currentPayloadChanges of [{purpose:'other'},{issuedAt:101},{expiresAt:100},{expiresAt:401},{issuedAt:-1},{sdkVersion:true},{sdkVersion:2},{sdkUrl:'https://example.com/sdk.js'},{sdkUrl:'//example.com/sdk.js'},{sdkIntegrity:'sha256-'+Buffer.alloc(32).toString('base64')},{extra:'field'}])await assert.rejects(verifySponsorSdkManifest(createSignedManifest(currentPayloadChanges),currentTrustedPublicKey,100));
 await assert.rejects(verifySponsorSdkManifest(createSignedManifest(),currentTrustedPublicKey,400));
 await assert.rejects(verifySponsorSdkManifest(createSignedManifest(),currentTrustedPublicKey,NaN));
});
