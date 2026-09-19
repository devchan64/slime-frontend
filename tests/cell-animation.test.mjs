import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {build} from 'esbuild';
const {outputFiles}=await build({stdin:{contents:`export * from './src/game/animation/cellAnimation';export * from './src/game/animation/cellAsset';export * from './src/game/animation/cellActor';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {CellAnimation,CellActor,readCellAsset,verifyCellSheet}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const manifest=JSON.parse(readFileSync('tests/fixtures/cell-animation-v2.json','utf8'));
const copy=()=>structuredClone(manifest.animation);

test('워크플로우 export의 v2 공개 항목을 읽고 정확한 프레임 경계·반복을 재생한다',()=>{
 const asset=readCellAsset(manifest),animation=asset.animation,clip=animation.clip('idle','down_left');
 for(const [time,frame] of [[0,'frame.0'],[99.9,'frame.0'],[100,'frame.1'],[349.9,'frame.1'],[350,'frame.0'],[700,'frame.0']])
  assert.equal(animation.sample(clip,time).frame.frameId,frame);
 assert.equal(animation.sample(clip,350*1e10+100).frame.frameId,'frame.1');
 assert.equal(animation.sample(clip,0).completed,false);
});
test('비반복 종료는 마지막 프레임을 유지하고 명시한 후속 클립은 남은 시간부터 재생한다',()=>{
 const data=copy();for(const c of data.clips)c.loop=false;
 let animation=new CellAnimation(data),clip=animation.clip('idle','down_left');
 assert.equal(animation.sample(clip,350).frame.frameId,'frame.1');
 assert.equal(animation.sample(clip,350).completed,true);
 for(const c of [...data.clips])data.clips.push({...structuredClone(c),clipId:`attack.${c.direction}`,action:'attack',nextClipId:c.clipId});
 animation=new CellAnimation(data);clip=animation.clip('attack','down_left');
 assert.equal(animation.sample(clip,350).clipId,'idle.down_left');
 assert.equal(animation.sample(clip,450).frame.frameId,'frame.1');
 assert.equal(animation.sample(clip,700).completed,true);
});
test('클립 순환의 긴 경과 시간도 단계 수만큼만 계산한다',()=>{
 const data=copy();
 for(const c of [...data.clips]){
  c.loop=false;c.nextClipId=`other.${c.direction}`;
  data.clips.push({...structuredClone(c),clipId:`other.${c.direction}`,action:'other',nextClipId:c.clipId});
 }
 const animation=new CellAnimation(data);
 const sample=animation.sample('idle.down_left',700*1e10+450);
 assert.equal(sample.clipId,'other.down_left');assert.equal(sample.frame.frameId,'frame.1');
});
test('원본 데이터 수정은 컴파일된 재생 상태에 영향을 주지 않는다',()=>{
 const data=copy(),animation=new CellAnimation(data);data.frames[0].anchor.x=99;
 assert.equal(animation.sample('idle.down_left',0).frame.anchor.x,.5);
 assert.throws(()=>animation.data.frames[0].anchor.x=99,TypeError);
 for(const elapsed of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>animation.sample('idle.down_left',elapsed));
 assert.throws(()=>animation.clip('unknown','down_left'));assert.throws(()=>animation.sample('unknown',0));
});
test('잘못된 영역·기준점·시간·방향·참조·종료를 대체하지 않는다',()=>{
 for(const change of [d=>d.frames[0].rect.x=4,d=>d.frames[0].anchor.y=3,d=>d.frames[0].anchor.x=NaN,
  d=>d.clips[0].frames[0].durationMs=0,d=>d.clips[0].frames[0].durationMs=true,
  d=>d.clips.pop(),d=>d.clips[0].direction='north',d=>d.clips[0].frames[0].frameId='missing',
  d=>d.animationId+='\n',d=>d.clips.push(structuredClone(d.clips[0])),d=>d.frames[0].extra=1,d=>d.clips[0].nextClipId='idle.down_right']){
  const data=copy();change(data);assert.throws(()=>new CellAnimation(data));
 }
});
test('공개 manifest의 이전 버전·경로·해시·비공개 필드는 거절한다',()=>{
 for(const change of [d=>d.compatibleSchemaVersion=1,d=>d.files=['../tile.png'],d=>d.hashes={},
  d=>d.assetId+='\n',d=>d.generation={},d=>d.attribution='',d=>d.assetType='TERRAIN_TILE']){
  const data=structuredClone(manifest);change(data);assert.throws(()=>readCellAsset(data));
 }
});
test('시트 해시 검증은 변경된 바이트를 거절하고 원본 버퍼와 독립된 Blob을 반환한다',async()=>{
 const bytes=new TextEncoder().encode('synthetic sheet byte test');
 const hash=createHash('sha256').update(bytes).digest('hex'),filename=hash+'.png';
 const asset=readCellAsset({...manifest,files:[filename],hashes:{[filename]:hash}});
 const blobPromise=verifyCellSheet(asset,bytes.buffer);bytes[0]=0;
 const blob=await blobPromise;assert.equal(await blob.text(),'synthetic sheet byte test');
 await assert.rejects(()=>verifyCellSheet(asset,bytes.buffer),/SHA-256/);
});
function scene(){
 const events=new EventEmitter(),frames=new Map();
 const texture={getSourceImage:()=>({width:4,height:2}),has:key=>frames.has(key),add:(key,...rect)=>{frames.set(key,rect);return {};}};
 const image=new EventEmitter();Object.assign(image,{x:10,y:20,depth:5,setScale(scale){this.scale=scale;return this;},setTexture(key,frame){this.key=key;this.frame=frame;return this;},setOrigin(x,y){this.origin={x,y};return this;},destroy(){this.emit('destroy');}});
 return {events,time:{now:0},textures:{exists:()=>true,get:()=>texture},add:{image:()=>image},frames,image,texture};
}
test('Phaser 어댑터는 발 위치·깊이·배율을 보존하고 이미지 제거 시 update를 해제한다',()=>{
 const s=scene(),animation=new CellAnimation(copy()),actor=new CellActor(s,'sheet',animation,{x:10,y:20,scale:.5,action:'idle',direction:'down_left'});
 assert.equal(s.frames.size,4);assert.deepEqual(actor.image.origin,{x:.5,y:1});
 s.time.now=100;s.events.emit('update',100);assert.match(actor.image.frame,/frame.1$/);
 actor.play('idle','down_left');assert.match(actor.image.frame,/frame.1$/);
 actor.play('idle','down_left',true);assert.match(actor.image.frame,/frame.0$/);
 assert.equal(actor.image.x,10);assert.equal(actor.image.y,20);assert.equal(actor.image.depth,5);assert.equal(actor.image.scale,.5);
 actor.image.destroy();assert.equal(s.events.listenerCount('update'),0);assert.equal(s.events.listenerCount('shutdown'),0);
 assert.throws(()=>actor.play('idle','down_left'));actor.destroy();
});
test('Phaser 장면 종료 시 어댑터가 정리되고 누락·크기 불일치 시트를 거절한다',()=>{
 const animation=new CellAnimation(copy()),options={x:0,y:0,scale:1,action:'idle',direction:'down_left'};
 const s=scene();new CellActor(s,'sheet',animation,options);s.events.emit('shutdown');assert.equal(s.events.listenerCount('update'),0);
 const missing=scene();missing.textures.exists=()=>false;assert.throws(()=>new CellActor(missing,'sheet',animation,options));
 const wrong=scene();wrong.texture.getSourceImage=()=>({width:5,height:2});assert.throws(()=>new CellActor(wrong,'sheet',animation,options));
 assert.equal(wrong.events.listenerCount('update'),0);
});
