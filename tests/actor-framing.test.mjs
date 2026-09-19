import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/game/terrain/actorFraming.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {fitActorZoom}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('가로·세로 화면에서 높은 유닛과 턴 번호를 기본 시점 안에 포함한다',()=>{
 const center={x:100,y:200};
 const actors=[{left:-150,right:-22,top:-80,bottom:70},{left:230,right:358,top:290,bottom:480}];
 for(const viewport of [{width:720,height:396},{width:360,height:260},{width:900,height:160}]){
  const zoom=fitActorZoom(1.4,center,viewport,actors);
  assert.ok(zoom>0&&zoom<=1.4);
  for(const actor of actors){
   assert.ok((actor.left-center.x)*zoom+viewport.width/2>=12-1e-8);
   assert.ok((actor.right-center.x)*zoom+viewport.width/2<=viewport.width-12+1e-8);
   assert.ok((actor.top-center.y)*zoom+viewport.height/2>=12-1e-8);
   assert.ok((actor.bottom-center.y)*zoom+viewport.height/2<=viewport.height-12+1e-8);
  }
 }
});

test('이미 충분히 축소됐거나 살아 있는 유닛이 없으면 배율을 바꾸지 않는다',()=>{
 assert.equal(fitActorZoom(.4,{x:0,y:0},{width:800,height:600},[{left:-20,right:20,top:-100,bottom:20}]),.4);
 assert.equal(fitActorZoom(1.4,{x:0,y:0},{width:800,height:600},[]),1.4);
});
