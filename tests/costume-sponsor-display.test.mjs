import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomUUID,randomBytes,sign} from 'node:crypto';
import {createCostumeSponsorDisplay} from '../src/client/costume-sponsor-display.mjs';
const currentSigningKeys=generateKeyPairSync('ed25519');
const currentPublicBytes=currentSigningKeys.publicKey.export({format:'der',type:'spki'}).subarray(-32);
const currentTrustedKey=currentPublicBytes.toString('base64');
const currentScriptDigest=createHash('sha256').update('sdk').digest();
const currentSdkIdentity={sdkVersion:1,sdkIntegrity:'sha256-'+currentScriptDigest.toString('base64'),sdkUrl:'/v1/sponsorship/sdk/1/'+currentScriptDigest.toString('hex')+'/costume.js'};
const currentDisplayContext={characterId:randomUUID(),generation:1,epoch:1,room:'map:a',costumeId:'default'};
function signDisplayPayload(currentPayloadRecord){
 const currentPayloadBytes=Buffer.from(JSON.stringify(currentPayloadRecord));
 return {algorithm:'Ed25519',keyId:createHash('sha256').update(currentPublicBytes).digest('hex'),publicKey:currentTrustedKey,payload:currentPayloadBytes.toString('base64'),signature:sign(null,currentPayloadBytes,currentSigningKeys.privateKey).toString('base64')};
}
function createDisplayFixture(){
 const currentFixtureState={context:{...currentDisplayContext},timestamp:110,mounts:0,destroys:0,requests:[],mountOptions:null,projection:null};
 const currentDisplayPayload={purpose:'slime-costume-display',...currentDisplayContext,attemptId:randomUUID(),nonce:randomBytes(32).toString('base64url'),sponsorshipId:'test',adAssetVersion:1,issuedAt:100,expiresAt:160,sdk:currentSdkIdentity,advertisement:{costumeId:'default',serverTime:100,sponsorship:{sponsorshipId:'test',version:1,endsAt:500,sponsorNameTranslations:{ko:'테스트',en:'Test'},messageTranslations:{ko:'광고',en:'Ad'}}}};
 const currentSessionResponse={serverTime:100,session:signDisplayPayload(currentDisplayPayload)};
 const currentManifestEnvelope=signDisplayPayload({purpose:'slime-sponsor-sdk',issuedAt:100,expiresAt:400,...currentSdkIdentity});
 const currentLoadedSdk={version:1,mount(currentContainerElement,currentProjectionRecord,currentMountOptions){currentFixtureState.mounts++;currentFixtureState.mountOptions=currentMountOptions;currentFixtureState.projection=currentProjectionRecord;return {destroy(){currentFixtureState.destroys++;}};}};
 const currentDisplayOptions={container:{},trustedPublicKey:currentTrustedKey,locale:'ko',readContext:()=>currentFixtureState.context,readServerTime:()=>currentFixtureState.timestamp,
 request:async(currentRequestPath)=>{currentFixtureState.requests.push(currentRequestPath);return currentRequestPath.endsWith('signed-manifest')?currentManifestEnvelope:currentSessionResponse;},loadSdk:async()=>currentLoadedSdk};
 return {currentFixtureState,currentSessionResponse,currentDisplayOptions,currentLoadedSdk};
}
test('정상 서명 세션을 SDK에 전달하고 지난 시간을 표시 타이머에 반영한다',async()=>{
 const {currentFixtureState,currentDisplayOptions}=createDisplayFixture();
 const currentDisplayHandle=createCostumeSponsorDisplay(currentDisplayOptions);await currentDisplayHandle.ready;
 assert.equal(currentFixtureState.mounts,1);assert.equal(currentFixtureState.requests.length,2);
 assert.equal(currentFixtureState.projection.sponsorship.endsAt,160);
 assert.equal(currentFixtureState.projection.serverTime,110);
 assert.ok(currentFixtureState.mountOptions.requestStartedAt>=0);
 assert.ok(currentFixtureState.mountOptions.requestStartedAt<=performance.now());
 currentDisplayHandle.destroy();currentDisplayHandle.destroy();assert.equal(currentFixtureState.destroys,1);
});
test('광고가 없으면 신뢰 키나 SDK 요청 없이 종료한다',async()=>{
 const {currentFixtureState,currentSessionResponse,currentDisplayOptions}=createDisplayFixture();currentSessionResponse.session=null;currentDisplayOptions.trustedPublicKey='';
 await createCostumeSponsorDisplay(currentDisplayOptions).ready;
 assert.equal(currentFixtureState.requests.length,1);assert.equal(currentFixtureState.mounts,0);
});
test('세션 요청 중 닫은 화면에는 늦은 응답을 표시하지 않는다',async()=>{
 const {currentFixtureState,currentDisplayOptions}=createDisplayFixture();
 const currentDisplayHandle=createCostumeSponsorDisplay(currentDisplayOptions);currentDisplayHandle.destroy();await currentDisplayHandle.ready;
 assert.equal(currentFixtureState.mounts,0);assert.equal(currentFixtureState.requests.length,1);
});
test('SDK 로드 중 공간 변경·닫기·만료가 발생하면 표시하지 않는다',async()=>{
 for(const currentCancellationMode of ['context','close','expiry']){
  const {currentFixtureState,currentDisplayOptions,currentLoadedSdk}=createDisplayFixture();
  let currentDisplayHandle;
  currentDisplayOptions.loadSdk=async()=>{if(currentCancellationMode==='context')currentFixtureState.context={...currentDisplayContext,room:'map:b'};if(currentCancellationMode==='close')currentDisplayHandle.destroy();if(currentCancellationMode==='expiry')currentFixtureState.timestamp=160;return currentLoadedSdk;};
  currentDisplayHandle=createCostumeSponsorDisplay(currentDisplayOptions);
  if(currentCancellationMode==='expiry')await assert.rejects(currentDisplayHandle.ready);else await currentDisplayHandle.ready;
  assert.equal(currentFixtureState.mounts,0);
 }
});
test('응답의 과거 서버 시각으로 만료 세션을 되살리지 않는다',async()=>{
 const {currentFixtureState,currentDisplayOptions}=createDisplayFixture();currentFixtureState.timestamp=160;
 await assert.rejects(createCostumeSponsorDisplay(currentDisplayOptions).ready);assert.equal(currentFixtureState.mounts,0);
});
