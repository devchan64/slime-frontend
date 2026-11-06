import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import ts from 'typescript';

const currentSceneSource=await readFile('src/game/scenes/MainScene.ts','utf8');
const currentSceneSyntax=ts.createSourceFile('MainScene.ts',currentSceneSource,ts.ScriptTarget.Latest,true);
const currentResizeStatements=[];
function collectResizeStatements(currentSyntaxNode){
 if(ts.isVariableStatement(currentSyntaxNode)&&currentSyntaxNode.declarationList.declarations.some(currentDeclaration=>['refreshResizedViewport','scheduleViewportRefresh'].includes(currentDeclaration.name.getText(currentSceneSyntax))))currentResizeStatements.push(currentSyntaxNode.getText(currentSceneSyntax));
 ts.forEachChild(currentSyntaxNode,collectResizeStatements);
}
collectResizeStatements(currentSceneSyntax);
const currentResizeCode=ts.transpileModule(currentResizeStatements.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('크기 변경이 반복되어도 수동 배율·카메라 위치를 보존하고 표시 갱신은 한 번만 예약한다',()=>{
 const currentGameEvents=new EventEmitter();
 const currentCameraState={zoom:3.2,scrollX:120,scrollY:240};
 let currentTerrainRefreshCount=0,currentActorRefreshCount=0;
 const currentSceneDouble={game:{events:currentGameEvents},cameras:{main:currentCameraState},focus(){currentCameraState.zoom=4;},syncTerrainViewport(){currentTerrainRefreshCount++;},syncActorViewport(){currentActorRefreshCount++;}};
 const currentResizeCallbacks=vm.runInNewContext(`(function(){${currentResizeCode};return {scheduleViewportRefresh,refreshResizedViewport};}).call(currentSceneDouble)`,{currentSceneDouble,Phaser:{Core:{Events:{POST_STEP:'poststep'}}}});
 for(const currentZoomValue of [3.2,5.6]){
  currentCameraState.zoom=currentZoomValue;
  currentResizeCallbacks.scheduleViewportRefresh();currentResizeCallbacks.scheduleViewportRefresh();
  assert.equal(currentGameEvents.listenerCount('poststep'),1);
  currentGameEvents.emit('poststep');
  assert.deepEqual(currentCameraState,{zoom:currentZoomValue,scrollX:120,scrollY:240});
 }
 assert.equal(currentTerrainRefreshCount,2);assert.equal(currentActorRefreshCount,2);
 currentResizeCallbacks.scheduleViewportRefresh();
 currentGameEvents.off('poststep',currentResizeCallbacks.refreshResizedViewport);
 assert.equal(currentGameEvents.listenerCount('poststep'),0);
});
