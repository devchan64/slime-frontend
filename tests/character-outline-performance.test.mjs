import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {build} from 'esbuild';
const {outputFiles:currentBuildFiles}=await build({entryPoints:['src/game/animation/characterOutline.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {attachCharacterOutlineLayers}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildFiles[0].text).toString('base64')}`);

function createOutlineSceneFixture(){
 const currentSceneEvents=new EventEmitter(),currentRenderImages=[],currentSetterCounts={};
 const currentTextureFrames=new Map();
 const currentTextureRecord={key:'actor'};
 function createFixtureImage(currentPositionX,currentPositionY,currentTextureKey,currentFrameName){
  const currentImageObject=Object.assign(new EventEmitter(),{x:currentPositionX,y:currentPositionY,originX:.5,originY:.5,scaleX:1,scaleY:1,flipX:false,flipY:false,rotation:0,depth:0,visible:true,alpha:1,scrollFactorX:1,scrollFactorY:1,texture:currentTextureRecord,frame:null});
  const currentAttributeNames={setOrigin:['originX','originY'],setScale:['scaleX','scaleY'],setFlip:['flipX','flipY'],setRotation:['rotation'],setPosition:['x','y'],setDepth:['depth'],setVisible:['visible'],setAlpha:['alpha'],setScrollFactor:['scrollFactorX','scrollFactorY'],setTintFill:['tint']};
  for(const [currentMethodName,currentFieldNames] of Object.entries(currentAttributeNames))currentImageObject[currentMethodName]=(...currentFieldValues)=>{currentSetterCounts[currentMethodName]=(currentSetterCounts[currentMethodName]??0)+1;currentFieldNames.forEach((currentFieldName,currentFieldIndex)=>currentImageObject[currentFieldName]=currentFieldValues[currentFieldIndex]);return currentImageObject;};
  currentImageObject.setTexture=(currentKeyValue,currentFrameValue)=>{currentSetterCounts.setTexture=(currentSetterCounts.setTexture??0)+1;if(!currentTextureFrames.has(currentFrameValue))currentTextureFrames.set(currentFrameValue,{name:currentFrameValue});currentImageObject.frame=currentTextureFrames.get(currentFrameValue);return currentImageObject;};
  currentImageObject.setTexture(currentTextureKey,currentFrameName);
  currentImageObject.setData=()=>currentImageObject;
  currentImageObject.getData=()=>0xffffff;
  currentImageObject.destroy=()=>{currentImageObject.emit('destroy');currentImageObject.destroyed=true;};
  return currentImageObject;
 }
 const currentActorImage=createFixtureImage(100,200,'actor','idle');
 currentActorImage.scene={events:currentSceneEvents,cameras:{main:{zoom:4}},add:{image(...currentImageArguments){const currentCreatedImage=createFixtureImage(...currentImageArguments);currentRenderImages.push(currentCreatedImage);return currentCreatedImage;}}};
 attachCharacterOutlineLayers(currentActorImage);
 return {currentSceneEvents,currentRenderImages,currentActorImage,currentSetterCounts};
}

test('외곽선은 정지 600프레임 동안 속성 재설정과 깊이 정렬을 추가하지 않는다',()=>{
 const currentFixtureState=createOutlineSceneFixture();
 const currentInitialCounts={...currentFixtureState.currentSetterCounts};
 for(let currentFrameIndex=0;currentFrameIndex<600;currentFrameIndex++)currentFixtureState.currentSceneEvents.emit('postupdate');
 assert.deepEqual(currentFixtureState.currentSetterCounts,currentInitialCounts);
 assert.equal(currentFixtureState.currentRenderImages.length,16);
});

test('이동·걷기 프레임·줌·깊이 변경은 필요한 외곽선 속성에 반영하고 폐기 시 해제한다',()=>{
 const {currentActorImage,currentRenderImages,currentSceneEvents,currentSetterCounts}=createOutlineSceneFixture();
 const currentInitialDepthCalls=currentSetterCounts.setDepth;
 currentActorImage.x+=20;currentActorImage.setTexture('actor','walk');currentSceneEvents.emit('postupdate');
 assert.equal(currentSetterCounts.setDepth,currentInitialDepthCalls);
 assert.ok(currentRenderImages.every(currentOutlineImage=>currentOutlineImage.frame===currentActorImage.frame));
 currentActorImage.scene.cameras.main.zoom=8;currentSceneEvents.emit('postupdate');
 assert.equal(currentRenderImages[0].x,currentActorImage.x-1.25,'흰색 선은 확대 후에도 화면 1px');
 currentActorImage.depth=10;currentSceneEvents.emit('postupdate');
 assert.equal(currentSetterCounts.setDepth,currentInitialDepthCalls+16);
 currentActorImage.setOrigin(.2,.7).setScale(2,3).setFlip(true,false).setRotation(.3).setVisible(false).setAlpha(.4).setScrollFactor(.5,.6);
 currentSceneEvents.emit('postupdate');
 for(const currentOutlineImage of currentRenderImages)for(const currentPropertyName of ['originX','originY','scaleX','scaleY','flipX','flipY','rotation','visible','alpha','scrollFactorX','scrollFactorY'])assert.equal(currentOutlineImage[currentPropertyName],currentActorImage[currentPropertyName]);
 currentActorImage.destroy();assert.equal(currentSceneEvents.listenerCount('postupdate'),0);assert.ok(currentRenderImages.every(currentOutlineImage=>currentOutlineImage.destroyed));
});
