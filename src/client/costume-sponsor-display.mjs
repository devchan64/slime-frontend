import {verifyCostumeDisplaySession, verifySponsorSdkManifest} from './sponsor-sdk-verification.mjs';
import {loadSignedSponsorSdk} from './sponsor-sdk-loader.mjs';
const DISPLAY_CONTEXT_FIELD_NAMES = ['characterId', 'generation', 'epoch', 'room', 'costumeId'];
/** 호출자는 화면 닫기·이동·로그아웃·언어 변경 시 destroy를 호출한다. */
export function createCostumeSponsorDisplay(currentDisplayOptions) {
  const {container:currentContainerElement, request:requestDisplayResource, readContext:readDisplayContext, readServerTime:readDisplayTimestamp,
    trustedPublicKey:currentTrustedPublicKey, locale:currentDisplayLocale, scriptNonce:currentScriptNonce='',
    loadSdk:loadDisplaySdk=loadSignedSponsorSdk}=currentDisplayOptions;
  const currentInitialContext={...readDisplayContext()};
  let currentDisplayDestroyed=false;
  let currentMountedDisplay=null;
  function displayContextMatches() {
    const currentLatestContext=readDisplayContext();
    return !currentDisplayDestroyed && currentLatestContext !== null
      && DISPLAY_CONTEXT_FIELD_NAMES.every(currentFieldName=>currentInitialContext[currentFieldName]===currentLatestContext[currentFieldName]);
  }
  function destroyCostumeDisplay() {
    currentDisplayDestroyed=true;
    currentMountedDisplay?.destroy();
    currentMountedDisplay=null;
  }
  async function prepareCostumeDisplay() {
    if (!displayContextMatches()) return;
    const currentSessionResponse=await requestDisplayResource('/v1/costumes/'+encodeURIComponent(currentInitialContext.costumeId)+'/sponsorship-sessions',{});
    if (!displayContextMatches()) return;
    if (!currentSessionResponse || typeof currentSessionResponse !== 'object' || Array.isArray(currentSessionResponse)
        || Object.keys(currentSessionResponse).sort().join() !== 'serverTime,session'
        || !Number.isFinite(currentSessionResponse.serverTime) || currentSessionResponse.serverTime < 0)
      throw new Error('광고 표시 세션 응답이 올바르지 않습니다.');
    if (currentSessionResponse.session === null) return;
    const currentVerifiedSession=await verifyCostumeDisplaySession(currentSessionResponse.session,currentTrustedPublicKey,readDisplayTimestamp(),currentInitialContext);
    if (!displayContextMatches()) return;
    const currentManifestEnvelope=await requestDisplayResource('/v1/sponsorship/sdk/signed-manifest');
    if (!displayContextMatches()) return;
    const currentVerifiedManifest=await verifySponsorSdkManifest(currentManifestEnvelope,currentTrustedPublicKey,readDisplayTimestamp());
    if (['sdkVersion','sdkIntegrity','sdkUrl'].some(currentFieldName=>currentVerifiedSession.sdk[currentFieldName]!==currentVerifiedManifest[currentFieldName]))
      throw new Error('광고 표시 세션과 SDK 배포 버전이 일치하지 않습니다.');
    if (!displayContextMatches()) return;
    const currentLoadedSdk=await loadDisplaySdk(currentManifestEnvelope,currentTrustedPublicKey,readDisplayTimestamp(),currentScriptNonce);
    if (!displayContextMatches()) return;
    const currentMountStarted=performance.now();
    const currentMountTimestamp=readDisplayTimestamp();
    if (!Number.isFinite(currentMountTimestamp) || currentMountTimestamp < currentVerifiedSession.issuedAt || currentMountTimestamp >= currentVerifiedSession.expiresAt) throw new Error('SDK 로드 중 광고 표시 세션이 만료되었습니다.');
    currentMountedDisplay=currentLoadedSdk.mount(currentContainerElement,{...currentVerifiedSession.advertisement,serverTime:currentMountTimestamp},
      {locale:currentDisplayLocale,requestStartedAt:currentMountStarted});
  }
  return Object.freeze({ready:prepareCostumeDisplay(),destroy:destroyCostumeDisplay});
}
