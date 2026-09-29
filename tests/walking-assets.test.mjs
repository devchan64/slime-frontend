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
    getSourceImage:()=>({width:2304,height:1536}),
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
test('4방향 걷기는 각 6프레임을 250ms 간격으로 반복하고 정지 시 대기 크기·기준점을 복구한다',()=>{
  const renderedCharacterImage=createCharacterTestImage();
  for(const currentDirectionName of ['down_left','down_right','up_left','up_right']) {
    for(let frameColumnIndex=0;frameColumnIndex<=6;frameColumnIndex++) {
      renderedCharacterImage.scene.time.now=frameColumnIndex*250;
      updateCharacterAnimationFrame(renderedCharacterImage,currentDirectionName,undefined,true);
      assert.equal(renderedCharacterImage.textureKey,DEFAULT_CHARACTER_WALK_ASSET.key);
      assert.ok(renderedCharacterImage.frame.name.endsWith(`${currentDirectionName}.${frameColumnIndex%6}`));
      const expectedAnchorCoordinates={down_left:[[212,348],[212,348],[212,348],[212,348],[212,348],[212,348]],down_right:[[189,343],[189,343],[189,343],[189,343],[189,343],[189,343]],up_left:[[191,347],[191,351],[191,349],[191,347],[191,351],[191,351]],up_right:[[201,341],[201,341],[201,341],[201,348],[200,352],[200,342]]};
      const selectedAnchorCoordinates=expectedAnchorCoordinates[currentDirectionName][frameColumnIndex%6];
      assert.equal(renderedCharacterImage.originX,selectedAnchorCoordinates[0]/384);
      assert.equal(renderedCharacterImage.originY,selectedAnchorCoordinates[1]/384);
      assert.equal(renderedCharacterImage.scaleX,80/352);
    }
    updateCharacterAnimationFrame(renderedCharacterImage,currentDirectionName,undefined,false);
    assert.equal(renderedCharacterImage.textureKey,'idle-human');
    assert.equal(renderedCharacterImage.scaleX,80/367.5);
  }
});
test('짧은 이동을 반복해도 걷기를 첫 프레임으로 재시작하지 않고 몬스터·휴식은 대기를 유지한다',()=>{
  const renderedCharacterImage=createCharacterTestImage();
  updateCharacterAnimationFrame(renderedCharacterImage,'down_right',undefined,true);
  updateCharacterAnimationFrame(renderedCharacterImage,'down_right',undefined,false);
  renderedCharacterImage.scene.time.now=750;
  updateCharacterAnimationFrame(renderedCharacterImage,'down_right',undefined,true);
  assert.ok(renderedCharacterImage.frame.name.endsWith('down_right.3'));
  for(const actorIdleKindValue of ['slime','human-rest']) {
    const otherCharacterImage=createCharacterTestImage(actorIdleKindValue);
    updateCharacterAnimationFrame(otherCharacterImage,'down_left',undefined,true);
    assert.notEqual(otherCharacterImage.textureKey,DEFAULT_CHARACTER_WALK_ASSET.key);
  }
});
