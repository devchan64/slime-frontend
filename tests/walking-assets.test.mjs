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
    getSourceImage:()=>({width:1536,height:768}),
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
test('정면왼쪽 걷기는 8프레임을 125ms 간격으로 반복하고 정지 시 대기 크기·기준점을 복구한다',()=>{
  const renderedCharacterImage=createCharacterTestImage();
  for(const currentDirectionName of ['down_left']) {
    for(let frameColumnIndex=0;frameColumnIndex<=8;frameColumnIndex++) {
      renderedCharacterImage.scene.time.now=frameColumnIndex*125;
      updateCharacterAnimationFrame(renderedCharacterImage,currentDirectionName,undefined,true);
      assert.equal(renderedCharacterImage.textureKey,DEFAULT_CHARACTER_WALK_ASSET.key);
      assert.ok(renderedCharacterImage.frame.name.endsWith(`${currentDirectionName}.${frameColumnIndex%8}`));
      assert.equal(renderedCharacterImage.originX,192/384);
      assert.equal(renderedCharacterImage.originY,376/384);
      assert.equal(renderedCharacterImage.scaleX,80/362.0);
    }
    updateCharacterAnimationFrame(renderedCharacterImage,currentDirectionName,undefined,false);
    assert.equal(renderedCharacterImage.textureKey,'idle-human');
    assert.equal(renderedCharacterImage.scaleX,80/367.5);
  }
});
test('짧은 이동을 반복해도 걷기를 첫 프레임으로 재시작하지 않고 몬스터·휴식은 대기를 유지한다',()=>{
  const renderedCharacterImage=createCharacterTestImage();
  updateCharacterAnimationFrame(renderedCharacterImage,'down_left',undefined,true);
  updateCharacterAnimationFrame(renderedCharacterImage,'down_left',undefined,false);
  renderedCharacterImage.scene.time.now=375;
  updateCharacterAnimationFrame(renderedCharacterImage,'down_left',undefined,true);
  assert.ok(renderedCharacterImage.frame.name.endsWith('down_left.3'));
  for(const actorIdleKindValue of ['slime','human-rest']) {
    const otherCharacterImage=createCharacterTestImage(actorIdleKindValue);
    updateCharacterAnimationFrame(otherCharacterImage,'down_left',undefined,true);
    assert.notEqual(otherCharacterImage.textureKey,DEFAULT_CHARACTER_WALK_ASSET.key);
  }
});
