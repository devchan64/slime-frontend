import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/scenes/MainScene.ts'],bundle:true,write:false,platform:'node',format:'esm',
 loader:{'.webp':'empty','.png':'empty'},define:{'import.meta.url':'"file:///test/scene.js"'},plugins:[{name:'phaser-double',setup(build){
  build.onResolve({filter:/^phaser$/},()=>({path:'phaser',namespace:'double'}));
  build.onLoad({filter:/.*/,namespace:'double'},()=>({contents:'export default {Scene:class {},Geom:{Point:class {constructor(x,y){this.x=x;this.y=y;}}}};'}));
 }}]});
const {MainScene}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('실제 씬의 필드 생성·카메라 이동·축소에서 지형 수명과 표시를 갱신한다',()=>{
 const scene=new MainScene(()=>{},()=>{},()=>{}),created=[];
 const object=(x=0,y=0)=>{
  const target={x,y,width:1024,height:1024,visible:true,destroyed:false};
  const proxy=new Proxy(target,{get(o,key){if(key in o)return o[key];return (...args)=>{
   if(key==='destroy'){assert.equal(o.destroyed,false);o.destroyed=true;}
   if(key==='setVisible')o.visible=args[0];
   if(key==='setPosition'){o.x=args[0];o.y=args[1];}
   if(key==='setScale'){o.displayWidth=o.width*args[0];o.displayHeight=o.height*args[0];}
   return proxy;
  };}});created.push(proxy);return proxy;
 };
 scene.add={graphics:()=>object(),image:(x,y)=>object(x,y)};
 scene.sys={isActive:()=>false};scene.textures={exists:()=>true};
 scene.cameras={main:{scrollX:700,scrollY:15000,width:800,height:600,zoom:1,setBounds(){},removeBounds(){}}};
 const state={map:{id:'meadow',columns:1000,rows:1000,startPoint:{column:2,row:2},safeRadius:3,connections:[],blocked:[]},battle:null};
 scene.setState(state);scene.updateTerrain(state,true);
 const first=new Set(scene.terrainObjects);assert.ok(first.size>0&&first.size<6000);
 scene.updateTerrain(structuredClone(state),true);assert.deepEqual(new Set(scene.terrainObjects),first);
 scene.cameras.main.scrollY+=4000;scene.update();
 assert.ok([...first].every(o=>o.destroyed));assert.ok(scene.terrainObjects.size>0&&scene.terrainObjects.size<6000);
 const normal=scene.terrainObjects.size;
 scene.cameras.main.zoom=0.5;scene.update();assert.ok(scene.terrainObjects.size>normal);
 assert.ok([...scene.terrainObjects].every(o=>!o.destroyed&&o.visible));
 scene.updateTerrain(state,false);assert.ok([...scene.terrainObjects].every(o=>!o.visible));
 scene.updateTerrain(state,true);assert.ok([...scene.terrainObjects].every(o=>o.visible));
 scene.terrainCache.clear();assert.equal(scene.terrainObjects.size,0);
});
