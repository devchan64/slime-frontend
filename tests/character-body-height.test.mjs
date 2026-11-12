import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBundleResult=await build({entryPoints:['src/game/animation/characterBodyHeight.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {resolveCharacterBodyHeight}=await import(`data:text/javascript;base64,${Buffer.from(currentBundleResult.outputFiles[0].text).toString('base64')}`);
const currentAnimationRecord={frames:[{frameId:'standing.0',rect:{height:450},anchor:{y:425}},{frameId:'sitting.1',rect:{height:450},anchor:{y:425}}]};
test('저장 기준 프레임의 앵커와 머리 Y로 모든 동작의 고정 높이를 산출한다',()=>{
 assert.equal(resolveCharacterBodyHeight({referenceBodyHeight:631,bodyReference:{frameId:'standing.0',headY:23}},currentAnimationRecord),402);
 assert.equal(80/resolveCharacterBodyHeight({referenceBodyHeight:631,bodyReference:{frameId:'standing.0',headY:23}},currentAnimationRecord),80/402);
});
test('머리 기준이 없는 기존 데이터는 등록된 신체 높이를 사용한다',()=>{
 assert.equal(resolveCharacterBodyHeight({referenceBodyHeight:631},currentAnimationRecord),631);
 assert.throws(()=>resolveCharacterBodyHeight({referenceBodyHeight:0},currentAnimationRecord));
});
test('저장된 기준이 잘못되면 기존 높이로 숨기지 않고 거절한다',()=>{
 for(const currentInvalidReference of [null,{}, {frameId:'missing',headY:1},{frameId:'standing.0',headY:425},{frameId:'standing.0',headY:-1},{frameId:'standing.0',headY:23,extra:true}])
  assert.throws(()=>resolveCharacterBodyHeight({referenceBodyHeight:631,bodyReference:currentInvalidReference},currentAnimationRecord));
 assert.throws(()=>resolveCharacterBodyHeight({bodyReference:{frameId:'standing.0',headY:23}},{frames:[currentAnimationRecord.frames[0],currentAnimationRecord.frames[0]]}));
});
test('걷기 재생에서 저장된 머리 기준이 실제 표시 배율에 적용된다',async()=>{
 const currentWalkBundle=await build({entryPoints:['src/game/animation/walkingActors.ts'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{name:'test-walk-reference',setup(build){build.onLoad({filter:/walk\/source\.yaml$/},()=>({contents:'referenceBodyHeight: 533\nbodyReference:\n  frameId: down_right.0\n  headY: 56\n',loader:'text'}));}}],define:{'import.meta.url':JSON.stringify('file:///sprite-test.ts')}});
 const {updateCharacterAnimationFrame}=await import(`data:text/javascript;base64,${Buffer.from(currentWalkBundle.outputFiles[0].text).toString('base64')}`);
 const currentTextureRecord={getSourceImage:()=>({width:1248,height:1174}),has:()=>false,add:()=>true};
 const currentCharacterValues=new Map([['actorIdleKind','human'],['actorDisplayHeight',80]]);
 const currentCharacterImage={scene:{textures:{exists:()=>true,get:()=>currentTextureRecord}},scaleX:1,getData(key){return currentCharacterValues.get(key)},setData(key,value){currentCharacterValues.set(key,value);return this},setTexture(){return this},setOrigin(){return this},setScale(value){this.scaleX=value;return this}};
 updateCharacterAnimationFrame(currentCharacterImage,'down_right',undefined,0);
 assert.equal(currentCharacterImage.scaleX,80/(560-56));
});
