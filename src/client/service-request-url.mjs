// 인증 서비스 주소는 배포 설정에서만 지정하며 요청 실패 시 다른 서비스로 전환하지 않는다.
export function createServiceRequestResolver(currentGameBaseUrl,currentIdentityBaseUrl){
 let currentIdentityOrigin=currentGameBaseUrl;
 if(currentIdentityBaseUrl!==undefined){
  const currentParsedAddress=new URL(currentIdentityBaseUrl);
  if(!['http:','https:'].includes(currentParsedAddress.protocol)||currentParsedAddress.username||currentParsedAddress.password||currentParsedAddress.search||currentParsedAddress.hash)
   throw new Error('인증 API는 인증 정보·쿼리 없는 HTTP(S) 주소여야 합니다.');
  currentIdentityOrigin=currentParsedAddress.href.replace(/\/$/,'');
 }
 return currentRequestPath=>(currentRequestPath.startsWith('/v1/auth/')?currentIdentityOrigin:currentGameBaseUrl)+currentRequestPath;
}
