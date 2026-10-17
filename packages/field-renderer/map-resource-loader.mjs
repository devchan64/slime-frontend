/** 맵 종류와 무관한 이미지 로딩 수명. 선택 리소스만 검증·중복 제거·제한 병렬 로딩한다. */
const MAP_RESOURCE_CONCURRENCY=6;
export async function loadMapResourceImages(currentResourceRecords,currentLoadOptions={}){
 const {signal:currentAbortSignal,onProgress:reportLoadProgress=()=>{},loadImage:loadImageResource=loadBrowserResourceImage}=currentLoadOptions;
 const currentUniqueResources=new Map(),currentKeySources=new Map();
 for(const currentResourceRecord of currentResourceRecords){
  if(!currentResourceRecord||typeof currentResourceRecord.key!=='string'||!currentResourceRecord.key||typeof currentResourceRecord.url!=='string'||!currentResourceRecord.url)throw Error('맵 리소스 키·URL이 필요합니다.');
  if(currentKeySources.has(currentResourceRecord.key)&&currentKeySources.get(currentResourceRecord.key)!==currentResourceRecord.url)throw Error('맵 리소스 키 충돌: '+currentResourceRecord.key);
  currentKeySources.set(currentResourceRecord.key,currentResourceRecord.url);currentUniqueResources.set(currentResourceRecord.url,currentResourceRecord);
 }
 const currentPendingResources=[...currentUniqueResources.values()],currentLoadedImages=new Map();
 const currentLoadController=new AbortController();
 const abortCurrentLoad=()=>currentLoadController.abort(currentAbortSignal?.reason);
 currentAbortSignal?.addEventListener('abort',abortCurrentLoad,{once:true});
 if(currentAbortSignal?.aborted)abortCurrentLoad();
 let currentNextIndex=0,currentCompletedCount=0;
 try{
  currentLoadController.signal.throwIfAborted();
  reportLoadProgress({completed:0,total:currentPendingResources.length});
  await Promise.all(Array.from({length:Math.min(MAP_RESOURCE_CONCURRENCY,currentPendingResources.length)},async()=>{
   while(currentNextIndex<currentPendingResources.length){
    currentLoadController.signal.throwIfAborted();
    const currentResourceRecord=currentPendingResources[currentNextIndex++];
    const currentLoadedImage=await loadImageResource(currentResourceRecord.url,currentLoadController.signal);
    currentLoadController.signal.throwIfAborted();currentLoadedImages.set(currentResourceRecord.url,currentLoadedImage);
    reportLoadProgress({completed:++currentCompletedCount,total:currentPendingResources.length});
   }
  }));
  return Object.fromEntries([...currentKeySources].map(([currentResourceKey,currentResourceUrl])=>[currentResourceKey,currentLoadedImages.get(currentResourceUrl)]));
 }catch(currentLoadError){currentLoadController.abort();throw currentLoadError;}
 finally{currentAbortSignal?.removeEventListener('abort',abortCurrentLoad);}
}
function loadBrowserResourceImage(currentResourceUrl,currentAbortSignal){
 return new Promise((resolveLoadedImage,rejectImageLoad)=>{
  const currentResourceImage=new Image();
  const releaseImageListeners=()=>{currentResourceImage.onload=null;currentResourceImage.onerror=null;currentAbortSignal.removeEventListener('abort',abortImageLoad);};
  const abortImageLoad=()=>{releaseImageListeners();currentResourceImage.src='';rejectImageLoad(currentAbortSignal.reason??new Error('맵 리소스 로딩 취소'));};
  currentResourceImage.onload=()=>{releaseImageListeners();resolveLoadedImage(currentResourceImage);};
  currentResourceImage.onerror=()=>{releaseImageListeners();rejectImageLoad(Error('맵 리소스 로드 실패: '+currentResourceUrl));};
  currentAbortSignal.addEventListener('abort',abortImageLoad,{once:true});
  if(currentAbortSignal.aborted){abortImageLoad();return;}
  currentResourceImage.src=currentResourceUrl;
 });
}
