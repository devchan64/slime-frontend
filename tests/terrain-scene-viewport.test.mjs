import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/scenes/MainScene.ts'],bundle:true,write:false,platform:'node',format:'esm',
 loader:{'.webp':'empty','.png':'empty'},define:{'import.meta.url':'"file:///test/scene.js"'},plugins:[{name:'phaser-double',setup(build){
  build.onResolve({filter:/^phaser$/},()=>({path:'phaser',namespace:'double'}));
  build.onLoad({filter:/.*/,namespace:'double'},()=>({contents:'export default {Scene:class {},Geom:{Point:class {constructor(x,y){this.x=x;this.y=y;}}}};'}));
 }}]});
const {MainScene}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('실제 씬에서 카메라 밖 개체의 몸체·그림자·이름표와 이동 참조를 함께 해제한다',()=>{
 const scene=new MainScene(()=>{},()=>{},()=>{}),created=[];
 scene.children={list:[]};scene.textures={exists:()=>true};
 const make=(x=0,y=0)=>{
  const target={scene,x,y,depth:0,width:1024,height:1024,destroyed:false};
  const proxy=new Proxy(target,{get(o,key){if(key in o)return o[key];return (...args)=>{
   if(key==='setPosition'){o.x=args[0];o.y=args[1];}
   if(key==='setDepth')o.depth=args[0];
   if(key==='destroy'){
    assert.equal(o.destroyed,false);o.destroyed=true;o.scene=null;
    scene.children.list=scene.children.list.filter(item=>item!==proxy);
   }
   return proxy;
  };}});scene.children.list.push(proxy);created.push(proxy);return proxy;
 };
 scene.add={graphics:()=>make(),image:(x,y)=>make(x,y),text:(x,y)=>make(x,y)};
 scene.project=p=>({x:p.column,y:p.row});scene.depth=()=>100;
 scene.viewSurface={columns:1000,rows:1000};
 scene.cameras={main:{scrollX:0,scrollY:0,width:200,height:200,zoom:1}};
 scene.queueUnit('near',{column:50,row:50},0xffffff,'주변',true,undefined,false,undefined,undefined,'member:near');
 scene.queueUnit('far',{column:3000,row:50},0xffffff,'먼 곳',true,undefined,false,undefined,undefined,'member:far');
 scene.rebuildActorViewport();
 assert.equal(created.length,4);assert.equal(scene.movingObjects.length,4);
 assert.ok(scene.movingObjects.every(item=>item.key==='member:near'));
 const initial=[...created];scene.cameras.main.scrollX=2900;scene.update();
 assert.ok(initial.every(item=>item.destroyed));assert.equal(scene.children.list.length,4);
 assert.ok(scene.movingObjects.every(item=>item.key==='member:far'&&!item.object.destroyed));
 scene.cameras.main.scrollX=0;scene.update();
 assert.equal(scene.children.list.length,4);
 assert.ok(scene.movingObjects.every(item=>item.key==='member:near'&&!item.object.destroyed));
 scene.actorCache.clear();assert.equal(scene.children.list.length,0);assert.equal(scene.movingObjects.length,0);
});

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
 const state={location:{id:'map:meadow'},monsters:[],members:[],map:{id:'meadow',columns:1000,rows:1000,startPoint:{column:2,row:2},safeRadius:3,connections:[],blocked:[]},battle:null};
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

test('실제 씬은 필드 몸체·그림자·이름표를 함께 이동하고 논리 선택 좌표를 유지한다',()=>{
 const scene=new MainScene(()=>{},()=>{},()=>{});
 scene.children={list:[]};scene.textures={exists:()=>true};
 const make=(x=0,y=0)=>{
  const object={scene,x,y,depth:0,width:1024,height:1024};
  const proxy=new Proxy(object,{get(o,key){if(key in o)return o[key];return (...args)=>{
   if(key==='setPosition'){o.x=args[0];o.y=args[1];}
   if(key==='setDepth')o.depth=args[0];
   return proxy;
  };}});scene.children.list.push(proxy);return proxy;
 };
 scene.add={graphics:()=>make(),image:(x,y)=>make(x,y),text:(x,y)=>make(x,y)};
 scene.project=()=>({x:164,y:82});scene.depth=()=>30030;
 scene.viewSurface={columns:1000,rows:1000};
 scene.selected={column:3,row:2};
 const now=performance.now();
 scene.fieldMotion.sync('map',[{id:'monster:s',cell:{column:2,row:2},point:{x:100,y:50,depth:30020}}],now);
 scene.fieldMotion.sync('map',[{id:'monster:s',cell:{column:3,row:2},point:{x:164,y:82,depth:30030}}],now);
 scene.unit({column:3,row:2},0xff0000,'슬라임',false,undefined,false,undefined,undefined,'monster:s');
 assert.equal(scene.movingObjects.length,4);
 scene.animateFieldActors();
 const first=scene.movingObjects[0],offset=first.object.x-first.x;
 assert.ok(offset<0&&offset>=-64);
 for(const item of scene.movingObjects){
  assert.ok(Math.abs(item.object.x-item.x-offset)<.001);
  assert.ok(Math.abs(item.object.y-item.y-offset/2)<.001);
 }
 assert.ok(first.object.depth<first.depth);
 for(const item of scene.movingObjects.filter(item=>item.depth>=scene.annotationDepth()))assert.equal(item.object.depth,item.depth);
 assert.ok(scene.annotationDepth()>30030);
 assert.deepEqual(scene.selected,{column:3,row:2});
});
