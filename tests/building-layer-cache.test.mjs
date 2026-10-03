import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/scenes/MainScene.ts'],bundle:true,write:false,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(process.cwd()+'/package.json');"},define:{'import.meta.url':JSON.stringify('file:///test/scene.js')},loader:{'.yaml':'text','.webp':'empty','.png':'empty'},plugins:[{name:'scene-test-dependencies',setup(currentBuildContext){
 currentBuildContext.onResolve({filter:/^phaser$/},()=>({path:'phaser',namespace:'mock'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export default {Scene:class {}};'}));
 currentBuildContext.onResolve({filter:/blockStructureRendering$/},()=>({path:'buildings',namespace:'building-mock'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'building-mock'},()=>({contents:`export function drawCityPaving() {} export function drawBlockStructure(scene,building){const object={destroy(){scene.disposedCount++;scene.children.list=scene.children.list.filter(value=>value!==object);}};scene.createdCount++;scene.children.list.push(object);return {id:building.id};}`}));
}}]});
const {MainScene}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
test('동일 건물은 상태 갱신에서 재사용하고 지형 변경·전투 진입에서 해제한다',()=>{
 const originalWindowDescriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:false})}});
 try {
  const currentTestScene=new MainScene(()=>{},()=>{},()=>{});
  currentTestScene.children={list:[]};currentTestScene.createdCount=0;currentTestScene.disposedCount=0;
  currentTestScene.annotationDepth=()=>100;currentTestScene.selected=null;
  const currentSceneState={map:{id:'town',buildings:[{id:'guild'}]},battle:null};
  currentTestScene.syncBuildingRenderLayer(currentSceneState);
  for(let updateSequenceIndex=0;updateSequenceIndex<60;updateSequenceIndex++)currentTestScene.syncBuildingRenderLayer(structuredClone(currentSceneState));
  assert.equal(currentTestScene.createdCount,1);assert.equal(currentTestScene.disposedCount,0);
  currentTestScene.terrainSignature='rotation-changed';currentTestScene.syncBuildingRenderLayer(currentSceneState);
  assert.equal(currentTestScene.createdCount,2);assert.equal(currentTestScene.disposedCount,1);
  currentTestScene.syncBuildingRenderLayer({...currentSceneState,battle:{}});
  assert.equal(currentTestScene.disposedCount,2);assert.equal(currentTestScene.children.list.length,0);
 } finally {if(originalWindowDescriptor)Object.defineProperty(globalThis,'window',originalWindowDescriptor);else delete globalThis.window;}
});
