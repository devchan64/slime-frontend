import {verifySponsorSdkManifest} from './sponsor-sdk-verification.mjs';
const SDK_SCRIPT_TIMEOUT_MILLISECONDS = 10000;
let loadedSdkIdentity = null;
let loadedSdkModule = null;
let loadingSdkOperation = null;
function readLoadedSdkModule(currentExpectedVersion) {
  const currentSdkModule = globalThis.SlimeCostumeSponsorSdk;
  if (!currentSdkModule || Object.keys(currentSdkModule).sort().join() !== 'mount,version'
      || currentSdkModule.version !== currentExpectedVersion || typeof currentSdkModule.mount !== 'function'
      || !Object.isFrozen(currentSdkModule)) throw new Error('로드된 광고 SDK 계약이 올바르지 않습니다.');
  return currentSdkModule;
}
export async function loadSignedSponsorSdk(currentSignedEnvelope, currentTrustedPublicKey, currentServerTimestamp, currentScriptNonce = '') {
  if (typeof currentScriptNonce !== 'string') throw new Error('광고 SDK 스크립트 nonce가 올바르지 않습니다.');
  const currentLoadStarted = performance.now();
  const currentVerifiedManifest = await verifySponsorSdkManifest(currentSignedEnvelope, currentTrustedPublicKey, currentServerTimestamp);
  const currentSdkIdentity = currentVerifiedManifest.sdkUrl + '#' + currentVerifiedManifest.sdkIntegrity;
  function requireCurrentManifest() {
    if (currentServerTimestamp + (performance.now() - currentLoadStarted) / 1000 >= currentVerifiedManifest.expiresAt) throw new Error('광고 SDK 서명이 로드 중 만료되었습니다.');
  }
  if (loadedSdkIdentity !== null && loadedSdkIdentity !== currentSdkIdentity) throw new Error('광고 SDK 버전이 변경되었습니다. 페이지를 새로고침하세요.');
  if (loadedSdkModule !== null) { requireCurrentManifest(); return loadedSdkModule; }
  if (loadingSdkOperation === null) {
    if (globalThis.SlimeCostumeSponsorSdk !== undefined) throw new Error('검증 경로 밖에서 로드된 광고 SDK입니다.');
    requireCurrentManifest();
    loadedSdkIdentity = currentSdkIdentity;
    const currentScriptElement = document.createElement('script');
    currentScriptElement.src = new URL(currentVerifiedManifest.sdkUrl, location.origin).href;
    currentScriptElement.integrity = currentVerifiedManifest.sdkIntegrity;
    currentScriptElement.crossOrigin = 'anonymous';
    currentScriptElement.referrerPolicy = 'no-referrer';
    if (currentScriptNonce) currentScriptElement.nonce = currentScriptNonce;
    loadingSdkOperation = new Promise((resolveSdkLoading, rejectSdkLoading) => {
      let currentLoadingSettled = false;
      let currentTimeoutHandle;
      function finishSdkLoading(currentLoadingError) {
        if (currentLoadingSettled) return;
        currentLoadingSettled = true;
        clearTimeout(currentTimeoutHandle);
        currentScriptElement.onload = null;
        currentScriptElement.onerror = null;
        currentScriptElement.remove();
        if (currentLoadingError) rejectSdkLoading(currentLoadingError);
        else resolveSdkLoading();
      }
      currentScriptElement.onload = () => {
        try { loadedSdkModule = readLoadedSdkModule(currentVerifiedManifest.sdkVersion); finishSdkLoading(); }
        catch (currentContractError) { finishSdkLoading(currentContractError); }
      };
      currentScriptElement.onerror = () => finishSdkLoading(new Error('광고 SDK 다운로드 또는 SRI 검증에 실패했습니다.'));
      currentTimeoutHandle = setTimeout(() => finishSdkLoading(new Error('광고 SDK 로드 시간이 초과되었습니다.')), SDK_SCRIPT_TIMEOUT_MILLISECONDS);
      try { document.head.append(currentScriptElement); }
      catch (currentAppendError) { finishSdkLoading(currentAppendError); }
    }).catch(currentLoadingError => {
      loadingSdkOperation = null;
      loadedSdkIdentity = null;
      loadedSdkModule = null;
      throw currentLoadingError;
    });
  }
  await loadingSdkOperation;
  requireCurrentManifest();
  return loadedSdkModule;
}
