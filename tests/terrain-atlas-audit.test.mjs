import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAssetListModule,buildMaterialFrameModule} from '../scripts/asset-list-module.mjs';

const currentRawGroundSizes = new Map([
 ['brine-bank-gravel-wide-sheet-v1',1024],['salt-flat-calm-brine-v1',1254],['salt-flat-mixed-soil-v1',1254],['salt-flat-crust-v2',1254],['mist-lake-deep-water-v1',1254],['mist-lake-silver-water-v2',1254],['dry-creek-eroded-sand-v1',1254],['reed-crossing-calm-water-v1',1254],
]);

test('게임 지형 아틀라스 초기화는 대형 지면 원본을 단일 타일로 처리하지 않고 오류 원본을 식별한다',async()=>{
 const {outputFiles}=await build({entryPoints:['src/game/terrain/textures.ts'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty','.webp':'empty'},plugins:[{name:'atlas-audit',setup(currentBuildContext){
  currentBuildContext.onLoad({filter:/field-material-frames\.yaml$/},async currentModuleArguments=>({contents:buildMaterialFrameModule(await readFile(currentModuleArguments.path,'utf8')),loader:'js'}));
  currentBuildContext.onLoad({filter:/\.asset-list\.yaml$/},async currentModuleArguments=>({contents:buildAssetListModule(await readFile(currentModuleArguments.path,'utf8'),resolve('../slime-assets')),loader:'js'}));
 }}]});
 const {createTerrainAtlas}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
 const currentGradient={addColorStop(){}};
 const currentContext=new Proxy({}, {get(_target,currentName){if(currentName==='createRadialGradient')return ()=>currentGradient;return ()=>{};},set(){return true;}});
 const currentOriginalDocument=globalThis.document;
 globalThis.document={createElement(){return {getContext(){return currentContext;}};}};
 const currentReadKeys=[];let currentInvalidKey='';
 const currentScene={textures:{exists(currentTextureKey){return currentTextureKey!=='meadow-terrain';},get(currentTextureKey){currentReadKeys.push(currentTextureKey);const currentFrameName=currentTextureKey.replace(/^terrain-source-/,'');const currentSize=currentTextureKey===currentInvalidKey?1254:currentRawGroundSizes.get(currentFrameName)??256;return {getSourceImage(){return {width:currentSize,height:currentSize};}};},createCanvas(){return {getContext(){return currentContext;},add(){},refresh(){}};}}};
 try{
  assert.doesNotThrow(()=>createTerrainAtlas(currentScene));
  for(const currentFrameName of currentRawGroundSizes.keys())assert.ok(!currentReadKeys.includes('terrain-source-'+currentFrameName));
  currentInvalidKey='terrain-source-grass';
  assert.throws(()=>createTerrainAtlas(currentScene),/타일 원본 크기 오류: terrain-source-grass/);
 }finally{globalThis.document=currentOriginalDocument;}
});
