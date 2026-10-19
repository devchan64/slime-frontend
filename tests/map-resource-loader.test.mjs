import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadMapResourceImages} from '../packages/field-renderer/map-resource-loader.mjs';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAssetListModule,buildMaterialFrameModule} from '../scripts/asset-list-module.mjs';

test('같은 URL을 한 번만 로드하고 키 충돌은 요청 전에 거절한다',async()=>{
 const currentRequestedUrls=[];
 const currentLoadedImages=await loadMapResourceImages([{key:'grass',url:'/grass.png'},{key:'underlay',url:'/grass.png'}],{loadImage:async currentResourceUrl=>{currentRequestedUrls.push(currentResourceUrl);return {url:currentResourceUrl};}});
 assert.deepEqual(currentRequestedUrls,['/grass.png']);assert.equal(currentLoadedImages.grass,currentLoadedImages.underlay);
 await assert.rejects(loadMapResourceImages([{key:'grass',url:'/a'},{key:'grass',url:'/b'}]),/키 충돌/);
});
test('취소된 맵은 이미지 요청과 완료 보고를 하지 않는다',async()=>{
 const currentAbortController=new AbortController();currentAbortController.abort();let currentRequestedCount=0;
 await assert.rejects(loadMapResourceImages([{key:'grass',url:'/grass.png'}],{signal:currentAbortController.signal,loadImage:async()=>{currentRequestedCount++;return {};}}));assert.equal(currentRequestedCount,0);
});
test('일부 리소스 실패는 나머지 진행 중 로딩도 취소한다',async()=>{
 let currentSiblingAborted=false;
 await assert.rejects(loadMapResourceImages([{key:'a',url:'/a'},{key:'b',url:'/b'}],{loadImage:async(currentResourceUrl,currentAbortSignal)=>{
 if(currentResourceUrl==='/a')throw Error('원본 없음');
 return new Promise((resolveLoadResult,rejectLoadResult)=>currentAbortSignal.addEventListener('abort',()=>{currentSiblingAborted=true;rejectLoadResult(Error('취소'));},{once:true}));
 }}),/원본 없음/);assert.equal(currentSiblingAborted,true);
});
test('야외·마을·전장은 실제 사용 지형과 해당 오브젝트만 계획한다',async()=>{
 const {outputFiles}=await build({entryPoints:['packages/field-renderer/map-resource-plan.ts'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty','.webp':'empty'},plugins:[{name:'resource-plan-test',setup(currentBuildContext){
 currentBuildContext.onLoad({filter:/field-material-frames\.yaml$/},async currentModuleArguments=>({contents:buildMaterialFrameModule(await readFile(currentModuleArguments.path,'utf8')),loader:'js'}));
 currentBuildContext.onLoad({filter:/\.asset-list\.yaml$/},async currentModuleArguments=>({contents:buildAssetListModule(await readFile(currentModuleArguments.path,'utf8'),resolve('../slime-assets')),loader:'js'}));
 }}]});
 const {collectMapResourceKeys}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
 const currentFieldRecord={id:'old-orchard',terrainRows:['gg'],terrainCodes:{g:'grass',w:'water'},objects:[{kind:'billboard',textureKey:'orchard-tree'}]};
 const currentFieldKeys=collectMapResourceKeys(currentFieldRecord,'field');assert.ok(currentFieldKeys.includes('orchard-tree'));assert.ok(!currentFieldKeys.includes('terrain-source-water'));assert.ok(!currentFieldKeys.includes('waypoint-guide-v1'));
 const currentTownKeys=collectMapResourceKeys({...currentFieldRecord,id:'iseulon',objects:[],buildings:[],connections:[{}]},'town');assert.ok(currentTownKeys.includes('terrain-source-iseulon-grass-mud-frame'));assert.ok(currentTownKeys.includes('waypoint-guide-v1'));assert.ok(!currentTownKeys.includes('orchard-tree'));
 const currentSpriteKeys=collectMapResourceKeys({...currentFieldRecord,id:'iseulon',objects:[],buildings:[{id:'iseulon-guild',facilityKind:'guild',sprite:{textureKey:'town-iseulon-guild-v1'}}]},'town');assert.ok(currentSpriteKeys.includes('town-iseulon-guild-v1'));assert.ok(!currentSpriteKeys.some(currentTextureKey=>/building-wall|wood-wall|stonewarm/.test(currentTextureKey)));assert.ok(!currentSpriteKeys.includes('town-reedhaven-guild-v1'));
 const currentBattleKeys=collectMapResourceKeys({id:'battle',cells:[{terrain:'grass',column:0,row:0},{terrain:'rock',column:1,row:0}]},'battle');assert.ok(currentBattleKeys.includes('terrain-source-battle-rock-b'));assert.ok(!currentBattleKeys.includes('orchard-tree'));
 const currentSharedBattleKeys=collectMapResourceKeys({id:'battle',cells:[{terrain:'upland-grass-earth',column:0,row:0}],objects:[{kind:'billboard',textureKey:'orchard-tree'}],groundOverrides:[{textureKey:'orchard-floor'}]},'battle');
 assert.ok(currentSharedBattleKeys.includes('terrain-source-upland-grass-earth-v1'));
 assert.ok(currentSharedBattleKeys.includes('orchard-tree'));assert.ok(currentSharedBattleKeys.includes('orchard-floor'));
 assert.ok(!currentSharedBattleKeys.includes('terrain-source-upland-grass-earth'));
 assert.throws(()=>collectMapResourceKeys({id:'battle',cells:[{terrain:'unknown-material',column:0,row:0}]},'battle'),/재질 코드/);
 assert.throws(()=>collectMapResourceKeys({...currentFieldRecord,terrainRows:['x']},'field'),/지형 코드/);
});
