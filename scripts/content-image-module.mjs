import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';

function parseContentImageDocument(currentSourceBytes){
 const currentYamlDocument=parseDocument(currentSourceBytes.toString(),{uniqueKeys:true});
 if(currentYamlDocument.errors.length)throw Error('콘텐츠 스냅샷 YAML 오류');
 return currentYamlDocument.toJS({maxAliasCount:0});
}
async function readBoundedContentFile(currentRootPath,currentRelativePath){
 if(typeof currentRelativePath!=='string'||currentRelativePath.split('/').some(currentPathPart=>!currentPathPart||currentPathPart==='.'||currentPathPart==='..')||currentRelativePath.includes('\\'))throw Error('콘텐츠 파일 경로 오류');
 const currentRealRoot=await realpath(currentRootPath),currentRealPath=await realpath(resolve(currentRootPath,currentRelativePath));
 if(!currentRealPath.startsWith(currentRealRoot+sep))throw Error('콘텐츠 파일 경로 이탈');
 return readFile(currentRealPath);
}
function verifyContentImageHash(currentSourceBytes,currentExpectedHash){
 if(!/^[a-f0-9]{64}$/.test(currentExpectedHash)||createHash('sha256').update(currentSourceBytes).digest('hex')!==currentExpectedHash)throw Error('콘텐츠 이미지·스냅샷 해시 불일치');
}
export async function collectContentImageFiles(currentAssetRoot,currentSnapshotRoot){
 const currentManifestRecord=parseContentImageDocument(await readBoundedContentFile(currentSnapshotRoot,'current.yaml'));
 if(currentManifestRecord.schema_version!==1||!Number.isSafeInteger(currentManifestRecord.generation)||!Array.isArray(currentManifestRecord.files))throw Error('콘텐츠 스냅샷 manifest 오류');
 const currentPublishedImages=new Map();
 const currentGenerationPrefix='generation-'+currentManifestRecord.generation+'-'+currentManifestRecord.payloadHash?.slice(0,16)+'/';
 for(const currentFileRecord of currentManifestRecord.files){
  if(!currentFileRecord.path.startsWith(currentGenerationPrefix))throw Error('콘텐츠 스냅샷 세대 불일치');
  const currentFileBytes=await readBoundedContentFile(currentSnapshotRoot,currentFileRecord.path);
  verifyContentImageHash(currentFileBytes,currentFileRecord.sha256);
  if(!currentFileRecord.path.startsWith(currentGenerationPrefix+'billboards/'))continue;
  const currentAssetPartition=parseContentImageDocument(currentFileBytes);
  if(currentAssetPartition.schema_version!==1||!Array.isArray(currentAssetPartition.assets))throw Error('콘텐츠 이미지 분류 오류');
  for(const currentAssetRecord of currentAssetPartition.assets){
   const currentImageRecord=currentAssetRecord.image;
   if(!/^\/registered-assets\/[a-zA-Z0-9_./-]+\.png$/.test(currentImageRecord.publishedPath)||!currentImageRecord.path.startsWith('assets/billboards/'))throw Error('지원하지 않는 콘텐츠 이미지 게시 경로');
   if(currentImageRecord.publishedPath.split('/').some(currentPathPart=>currentPathPart==='..'||currentPathPart==='.'))throw Error('이미지 게시 경로 이탈');
   const currentImageBytes=await readBoundedContentFile(currentAssetRoot,currentImageRecord.path);
   verifyContentImageHash(currentImageBytes,currentImageRecord.sha256);
   const currentPreviousImage=currentPublishedImages.get(currentImageRecord.publishedPath);
   if(currentPreviousImage&&currentPreviousImage.sha256!==currentImageRecord.sha256)throw Error('동일 게시 경로의 이미지 충돌');
   currentPublishedImages.set(currentImageRecord.publishedPath,{bytes:currentImageBytes,sha256:currentImageRecord.sha256});
  }
 }
 if(!currentPublishedImages.size)throw Error('게시할 콘텐츠 이미지가 없습니다.');
 return currentPublishedImages;
}

export function createContentImagePlugin(currentAssetRoot,currentSnapshotRoot){
 let currentCachedSignature='',currentCachedImages=null;
 async function loadCurrentPublishedImages(){
  const currentPointerStatus=await stat(resolve(currentSnapshotRoot,'current.yaml'));
  const currentPointerSignature=currentPointerStatus.mtimeMs+':'+currentPointerStatus.size;
  if(currentCachedSignature!==currentPointerSignature){
   currentCachedImages=await collectContentImageFiles(currentAssetRoot,currentSnapshotRoot);
   currentCachedSignature=currentPointerSignature;
  }
  return currentCachedImages;
 }
 return {name:'database-content-images',
  async generateBundle(){
   for(const [currentPublicPath,currentImageRecord] of await loadCurrentPublishedImages())
    this.emitFile({type:'asset',fileName:currentPublicPath.slice(1),source:currentImageRecord.bytes});
  },
  configureServer(currentDevServer){
   currentDevServer.middlewares.use(async(currentRequest,currentResponse,currentNextHandler)=>{
    const currentRequestPath=(currentRequest.url??'').split('?')[0];
    if(!currentRequestPath.startsWith('/registered-assets/'))return currentNextHandler();
    try{
     if(!['GET','HEAD'].includes(currentRequest.method)){currentResponse.statusCode=405;currentResponse.end();return;}
     let currentImageRecord=(await loadCurrentPublishedImages()).get(currentRequestPath);
     // 편집 직후의 해시 파일은 다음 스냅샷을 기다리지 않고 같은 원본에서 읽는다.
     const currentVersionMatch=/^\/registered-assets\/assets\/billboards\/versions\/([a-f0-9]{64})\.png$/.exec(currentRequestPath);
     if(!currentImageRecord&&currentVersionMatch){
      const currentImageBytes=await readBoundedContentFile(currentAssetRoot,'assets/billboards/versions/'+currentVersionMatch[1]+'.png');
      verifyContentImageHash(currentImageBytes,currentVersionMatch[1]);
      currentImageRecord={bytes:currentImageBytes,sha256:currentVersionMatch[1]};
     }
     if(!currentImageRecord){currentResponse.statusCode=404;currentResponse.end();return;}
     currentResponse.setHeader('Content-Type','image/png');
     currentResponse.setHeader('ETag','"'+currentImageRecord.sha256+'"');
     currentResponse.setHeader('Cache-Control',currentVersionMatch?'public, max-age=31536000, immutable':'no-cache');
     currentResponse.end(currentRequest.method==='HEAD'?undefined:currentImageRecord.bytes);
    }catch(currentImageError){currentDevServer.config.logger.error(String(currentImageError));currentResponse.statusCode=500;currentResponse.end('콘텐츠 이미지 준비 실패');}
   });
  }
 };
}
