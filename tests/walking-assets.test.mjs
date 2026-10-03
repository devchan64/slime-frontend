import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const walkingBundleResult = await build({entryPoints:['src/game/animation/walkingActors.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(pathToFileURL(resolve('src/game/animation/walkingActors.ts')).href)}});
const {DEFAULT_CHARACTER_WALK_ASSET,updateCharacterAnimationFrame} = await import(`data:text/javascript;base64,${Buffer.from(walkingBundleResult.outputFiles[0].text).toString('base64')}`);
function createCharacterTestImage(actorIdleKindValue = 'human') {
  const characterDataValues = new Map(Object.entries({actorIdleKind:actorIdleKindValue,idlePhaseOffset:0,actorDisplayHeight:80}));
  const registeredTextureFrames = new Set();
  const walkingTextureRecord = {
    getSourceImage:()=>({width:4608,height:384}),
    has:(currentFrameIdentifier)=>registeredTextureFrames.has(currentFrameIdentifier),
    add(currentFrameIdentifier){registeredTextureFrames.add(currentFrameIdentifier);return {};},
  };
  return {
    scene:{time:{now:0},textures:{exists:()=>true,get:()=>walkingTextureRecord}},
    frame:{name:''},scaleX:80/367.5,originX:0,originY:0,
    getData(currentDataIdentifier){return characterDataValues.get(currentDataIdentifier);},
    setData(currentDataIdentifier,currentDataValue){characterDataValues.set(currentDataIdentifier,currentDataValue);return this;},
    setScale(currentScaleValue){this.scaleX=currentScaleValue;return this;},
    setTexture(currentTextureIdentifier,currentFrameIdentifier){this.textureKey=currentTextureIdentifier;this.frame.name=currentFrameIdentifier;return this;},
    setOrigin(currentOriginValueX,currentOriginValueY){this.originX=currentOriginValueX;this.originY=currentOriginValueY;return this;},
  };
}
test('정면왼쪽 걷기는 12프레임을 125ms 간격으로 반복하고 정지 시 대기 크기·기준점을 복구한다',()=>{
  const renderedCharacterImage=createCharacterTestImage();
  renderedCharacterImage.scene.time.now=2371;
  for(const currentDirectionName of ['down_left']) {
    for(let frameColumnIndex=0;frameColumnIndex<=12;frameColumnIndex++) {
      renderedCharacterImage.scene.time.now=2371+frameColumnIndex*125;
      updateCharacterAnimationFrame(renderedCharacterImage,currentDirectionName,undefined,frameColumnIndex*125);
      assert.equal(renderedCharacterImage.textureKey,DEFAULT_CHARACTER_WALK_ASSET.key);
      assert.ok(renderedCharacterImage.frame.name.endsWith(`${currentDirectionName}.${frameColumnIndex%12}`));
      assert.equal(renderedCharacterImage.originX,192/384);
      assert.equal(renderedCharacterImage.originY,346/384);
      assert.equal(renderedCharacterImage.scaleX,80/360.0);
    }
    updateCharacterAnimationFrame(renderedCharacterImage,currentDirectionName,undefined,undefined);
    assert.equal(renderedCharacterImage.textureKey,'idle-human');
    assert.equal(renderedCharacterImage.scaleX,80/367.5);
  }
});
test('이동 재시작은 첫 프레임부터 재생하고 몬스터·휴식은 대기를 유지한다',()=>{
  const renderedCharacterImage=createCharacterTestImage();
  updateCharacterAnimationFrame(renderedCharacterImage,'down_left',undefined,0);
  updateCharacterAnimationFrame(renderedCharacterImage,'down_left',undefined,undefined);
  renderedCharacterImage.scene.time.now=375;
  updateCharacterAnimationFrame(renderedCharacterImage,'down_left',undefined,0);
  assert.ok(renderedCharacterImage.frame.name.endsWith('down_left.0'));
  for(const actorIdleKindValue of ['slime','human-rest']) {
    const otherCharacterImage=createCharacterTestImage(actorIdleKindValue);
    updateCharacterAnimationFrame(otherCharacterImage,'down_left',undefined,0);
    assert.notEqual(otherCharacterImage.textureKey,DEFAULT_CHARACTER_WALK_ASSET.key);
  }
});


test('화면 재생성 후에도 이동 경과 시간으로 같은 걷기 프레임을 이어 표시한다',()=>{
 const originalCharacterImage=createCharacterTestImage();
 const recreatedCharacterImage=createCharacterTestImage();
 originalCharacterImage.scene.time.now=100;
 recreatedCharacterImage.scene.time.now=2000;
 updateCharacterAnimationFrame(originalCharacterImage,'down_left',undefined,875);
 updateCharacterAnimationFrame(recreatedCharacterImage,'down_left',undefined,875);
 assert.equal(originalCharacterImage.frame.name,recreatedCharacterImage.frame.name);
 assert.ok(recreatedCharacterImage.frame.name.endsWith('down_left.7'));
 updateCharacterAnimationFrame(recreatedCharacterImage,'down_left',undefined,1500);
 assert.ok(recreatedCharacterImage.frame.name.endsWith('down_left.0'));
});
