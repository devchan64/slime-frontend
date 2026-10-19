import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSurfaceHeight,readGroundSurfaceHeight,projectSurfaceCell,projectSurfaceVertex} from '../packages/field-surface/field-surface.mjs';
import {validateBridgeSurfaces,canTraverseBridgeEdge} from '../packages/field-surface/terrain-bridges.mjs';
import {buildFieldCellGeometry,resolveFieldSurfaceDepth,FIELD_RENDER_METRICS} from '../packages/field-renderer/field-renderer.mjs';
const currentBridgeSurface={columns:10,rows:10,elevations:Array.from({length:10},()=>[8,8,8,8,0,0,0,8,8,8]),bridges:[{id:'high-crossing',start:{column:3,row:5},end:{column:7,row:5},elevation:8,material:'timber'}]};
test('고지대 교량은 지면·상판을 분리하고 캐릭터는 상판에 투영한다',()=>{
 validateBridgeSurfaces(currentBridgeSurface);
 const currentCellPosition={column:5,row:5};
 assert.equal(readSurfaceHeight(currentCellPosition,currentBridgeSurface),8);
 assert.equal(readGroundSurfaceHeight(currentCellPosition,currentBridgeSurface),0);
 const currentFaces=buildFieldCellGeometry(currentCellPosition,currentBridgeSurface,FIELD_RENDER_METRICS);
 assert.ok(currentFaces.some(currentFaceRecord=>currentFaceRecord.kind==='bridge'&&currentFaceRecord.top));
 assert.equal(currentFaces.filter(currentFaceRecord=>currentFaceRecord.kind==='cliff').length,0);
 const currentGroundFace=currentFaces.find(currentFaceRecord=>currentFaceRecord.kind==='ground');
 const currentGroundCenter=currentGroundFace.points.reduce((currentSumValue,currentPointRecord)=>currentSumValue+currentPointRecord.y,0)/4;
 assert.equal(currentGroundCenter-projectSurfaceCell(currentCellPosition,currentBridgeSurface,FIELD_RENDER_METRICS).y,8*FIELD_RENDER_METRICS.elevationHeight);
});
test('양끝 출입과 양방향 이동만 허용하고 난간 방향은 금지한다',()=>{
 assert.equal(canTraverseBridgeEdge({column:3,row:5},{column:4,row:5},currentBridgeSurface),true);
 assert.equal(canTraverseBridgeEdge({column:4,row:5},{column:3,row:5},currentBridgeSurface),true);
 assert.equal(canTraverseBridgeEdge({column:5,row:5},{column:5,row:6},currentBridgeSurface),false);
 assert.equal(canTraverseBridgeEdge({column:5,row:6},{column:5,row:5},currentBridgeSurface),false);
});
test('겹침·진입 고도·대각선·미지원 재질은 즉시 거절한다',()=>{
 for(const currentInvalidPatch of [{elevation:2},{material:'glass'},{start:{column:3,row:4}},{elevation:true},{unknown:true}]){
  const currentInvalidSurface=structuredClone(currentBridgeSurface);Object.assign(currentInvalidSurface.bridges[0],currentInvalidPatch);
  assert.throws(()=>validateBridgeSurfaces(currentInvalidSurface));
 }
 const currentDuplicateSurface=structuredClone(currentBridgeSurface);currentDuplicateSurface.bridges.push(currentDuplicateSurface.bridges[0]);assert.throws(()=>validateBridgeSurfaces(currentDuplicateSurface));
});

import {build} from 'esbuild';
async function loadBridgeClientModule(currentModulePath){
 const currentBuildResult=await build({entryPoints:[currentModulePath],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
}
const currentElevationModule=await loadBridgeClientModule('src/game/terrain/elevation.ts');
const currentCostModule=await loadBridgeClientModule('src/ui/terrainMovementCost.ts');
const currentRotationModule=await loadBridgeClientModule('src/game/terrain/rotation.ts');
test('실제 길찾기와 FP 예측이 수면 비용 대신 교량 도로 비용을 사용한다',()=>{
 const currentMapRecord={...structuredClone(currentBridgeSurface),terrainMovementVersion:2,blocked:[],terrainRows:Array(10).fill('ggggqqqggg'),terrainCodes:{g:'grass',q:'deep-water'},movementCosts:{rows:[{tileId:'grass',fp:{baseCost:2,extraChanceBasisPoints:0,extraCost:0}},{tileId:'road',fp:{baseCost:1,extraChanceBasisPoints:0,extraCost:0}},{tileId:'deep-water',fp:null}]}};
 for(let currentRowIndex=0;currentRowIndex<10;currentRowIndex++)for(let currentColumnIndex=4;currentColumnIndex<=6;currentColumnIndex++)if(currentRowIndex!==5)currentMapRecord.blocked.push({column:currentColumnIndex,row:currentRowIndex});
 const currentRouteCells=currentCostModule.findExpectedFieldRoute({column:3,row:5},[{column:7,row:5}],currentMapRecord);
 assert.deepEqual(currentRouteCells,[4,5,6,7].map(currentColumnIndex=>({column:currentColumnIndex,row:5})));
 assert.equal(currentCostModule.fieldMovementEstimate(currentMapRecord,currentRouteCells).base,5);
 for(let currentRotationValue=0;currentRotationValue<4;currentRotationValue++){
  const currentRotatedSurface=currentRotationModule.rotatedSurface(currentMapRecord,currentRotationValue);
  const currentStartPosition=currentRotationModule.toView({column:3,row:5},currentMapRecord,currentRotationValue),currentEndPosition=currentRotationModule.toView({column:4,row:5},currentMapRecord,currentRotationValue);
  assert.equal(currentElevationModule.canStep(currentStartPosition,currentEndPosition,currentRotatedSurface),true);
  assert.equal(currentElevationModule.heightAt(currentEndPosition,currentRotatedSurface),8);
 }
});

import {prepareBridgeTraversalSurface} from '../packages/field-surface/terrain-bridges.mjs';
test('검수 원본은 상판만 차단을 해제하고 원본 수면은 보존한다',()=>{
 const currentSourceSurface={...structuredClone(currentBridgeSurface),terrainMovementVersion:2,blocked:[{column:5,row:5},{column:5,row:6}]};
 const currentReviewSurface=prepareBridgeTraversalSurface(currentSourceSurface);
 assert.deepEqual(currentReviewSurface.blocked,[{column:5,row:6}]);
 assert.equal(currentSourceSurface.blocked.length,2);
 assert.equal(currentReviewSurface.elevations[5][5],0);
});
const currentRoadModule=await loadBridgeClientModule('src/game/terrain/roadTiles.ts');
test('다리 아래 수면 연결은 상판 높이와 난간 이동에 영향받지 않는다',()=>{
 const currentWaterCells=new Set(['5,5','5,4','5,6']);
 assert.equal(currentRoadModule.waterConnections({column:5,row:5},currentBridgeSurface,currentWaterCells),5);
});
import {buildBridgeCellGeometry,resolveBridgeTextureKey,resolveBridgeTextureKeys} from '../packages/field-renderer/bridge-geometry.mjs';
test('교량 재질별 스프라이트·상판·투명 난간·접속부를 분리한다',()=>{
 for(const currentMaterialName of ['timber','stone'])for(const currentRotationValue of [0,1,2,3]){
  const currentMapSurface=structuredClone(currentBridgeSurface);currentMapSurface.bridges[0].material=currentMaterialName;
  const currentPanelFaces=buildBridgeCellGeometry({column:5,row:5},currentMapSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationValue});
  assert.equal(currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='deck').length,1);
  const currentRailFaces=currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='rail');
  assert.equal(currentRailFaces.length,2);assert.deepEqual(currentRailFaces.map(currentRailFace=>currentRailFace.depthOffset).sort((a,b)=>a-b),[2,40]);
  for(const currentPanelFace of currentPanelFaces){assert.ok(resolveBridgeTextureKeys(currentMaterialName).includes(currentPanelFace.textureKey));assert.equal(currentPanelFace.uvCorners.length,8);assert.ok(currentPanelFace.uvCorners.every(currentUvValue=>currentUvValue>=0&&currentUvValue<=1));}
  assert.ok(buildBridgeCellGeometry({column:3,row:5},currentMapSurface,FIELD_RENDER_METRICS).some(currentPanelFace=>currentPanelFace.part==='abutment'));
 }
 assert.throws(()=>resolveBridgeTextureKey('glass'));
});
test('석교 측면 아치는 전체 경간을 한 면으로 그리고 앞뒤·내부 깊이를 통일한다',()=>{
 for(const currentRotationValue of [0,1,2,3]){
  const currentMapSurface=structuredClone(currentBridgeSurface);currentMapSurface.bridges[0].material='stone';
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  const currentAllFaces=[4,5,6].flatMap(currentColumnIndex=>buildBridgeCellGeometry({column:currentColumnIndex,row:5},currentMapSurface,currentRenderOptions));
  const currentArchFaces=currentAllFaces.filter(currentPanelFace=>currentPanelFace.part==='beam');
  const currentVaultFaces=currentAllFaces.filter(currentPanelFace=>currentPanelFace.part==='vault');
  assert.equal(currentArchFaces.length,2);
  assert.ok(currentArchFaces.every(currentPanelFace=>currentPanelFace.uvCorners[0]===.02&&currentPanelFace.uvCorners[2]===.98));
  assert.ok(currentAllFaces.filter(currentPanelFace=>currentPanelFace.depthAnchor).every(currentPanelFace=>JSON.stringify(currentPanelFace.depthAnchor)===JSON.stringify(currentArchFaces[0].depthAnchor)));
  const currentArchLayers=currentArchFaces.map(currentPanelFace=>currentPanelFace.structureLayer).sort();
  assert.ok(currentVaultFaces.every(currentPanelFace=>currentPanelFace.structureLayer>currentArchLayers[0]&&currentPanelFace.structureLayer<currentArchLayers[1]));
 }
});
test('교량 양끝 접속은 네 회전·진입 높이 차이에서 유한한 형상과 양안 기초를 유지한다',()=>{
 for(const currentMaterialName of ['timber','stone'])for(const currentRotationValue of [0,1,2,3])for(const currentHeightDelta of [-1,0,1]){
  const currentMapSurface=structuredClone(currentBridgeSurface);
  currentMapSurface.bridges[0].material=currentMaterialName;
  for(const currentEndColumn of [3,7]){
   currentMapSurface.elevations[5][currentEndColumn]=8+currentHeightDelta;
   const currentPanelFaces=buildBridgeCellGeometry({column:currentEndColumn,row:5},currentMapSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationValue});
   assert.equal(currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='deck').length,1);
   assert.equal(currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='rail').length,2);
   assert.ok(currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='abutment').length<=3);
   assert.equal(currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='bearing').length,0);
   assert.equal(currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='threshold'&&currentPanelFace.top).length,1);
   assert.ok(currentPanelFaces.every(currentPanelFace=>currentPanelFace.points.every(currentScreenPoint=>Number.isFinite(currentScreenPoint.x)&&Number.isFinite(currentScreenPoint.y))));
  }
  assert.equal(currentMapSurface.elevations[5][5],0);
 }
});
test('진입 상판과 본체는 네 회전에서 틈·높이 단차 없이 같은 두 접점을 공유한다',()=>{
 for(const currentRotationValue of [0,1,2,3]){
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  for(const [currentEndColumn,currentSpanColumn] of [[3,4],[7,6]]){
   const currentEntryFace=buildBridgeCellGeometry({column:currentEndColumn,row:5},currentBridgeSurface,currentRenderOptions).find(currentPanelFace=>currentPanelFace.part==='deck');
   const currentSpanFace=buildBridgeCellGeometry({column:currentSpanColumn,row:5},currentBridgeSurface,currentRenderOptions).find(currentPanelFace=>currentPanelFace.part==='deck');
   for(const currentContactPoint of currentEntryFace.points.slice(1,3))assert.ok(currentSpanFace.points.some(currentSpanPoint=>Math.abs(currentContactPoint.x-currentSpanPoint.x)<1e-8&&Math.abs(currentContactPoint.y-currentSpanPoint.y)<1e-8));
  }
 }
});
test('공통 아치 내부는 인접 타일과 연속된다',()=>{
 for(const currentRotationValue of [0,1,2,3]){
  const currentMapSurface=structuredClone(currentBridgeSurface);currentMapSurface.bridges[0].material='stone';
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  const currentFirstVaults=buildBridgeCellGeometry({column:4,row:5},currentMapSurface,currentRenderOptions).filter(currentPanelFace=>currentPanelFace.part==='vault');
  const currentNextVaults=buildBridgeCellGeometry({column:5,row:5},currentMapSurface,currentRenderOptions).filter(currentPanelFace=>currentPanelFace.part==='vault');
  assert.equal(currentFirstVaults.length,4);
  assert.deepEqual(currentFirstVaults.at(-1).points[1],currentNextVaults[0].points[0]);
  assert.deepEqual(currentFirstVaults.at(-1).points[2],currentNextVaults[0].points[3]);
  assert.equal(currentFirstVaults.at(-1).uvCorners[2],currentNextVaults[0].uvCorners[0]);
 }
 assert.ok(buildBridgeCellGeometry({column:4,row:5},currentBridgeSurface,FIELD_RENDER_METRICS).some(currentPanelFace=>currentPanelFace.part==='vault'));
});

test('목교와 석교의 경간 깊이를 통일한다',()=>{
 const currentStoneSurface=structuredClone(currentBridgeSurface);
 currentStoneSurface.bridges[0].material='stone';
 for(const currentRotationValue of [0,1,2,3]){
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  const currentCellPositions=[4,5,6].map(currentColumnIndex=>({column:currentColumnIndex,row:5}));
  assert.equal(new Set(currentCellPositions.map(currentCellPosition=>resolveFieldSurfaceDepth(currentCellPosition,currentStoneSurface,currentRenderOptions))).size,1);
  assert.equal(new Set(currentCellPositions.map(currentCellPosition=>resolveFieldSurfaceDepth(currentCellPosition,currentBridgeSurface,currentRenderOptions))).size,1);
  const currentBridgeFaces=currentCellPositions.flatMap(currentCellPosition=>buildFieldCellGeometry(currentCellPosition,currentStoneSurface,currentRenderOptions));
  assert.ok(currentBridgeFaces.filter(currentFaceRecord=>currentFaceRecord.depthAnchor).every(currentFaceRecord=>currentFaceRecord.structureLayer<1));
 }
});

test('석교 아치 양끝은 서로 다른 하상 높이의 기초까지 이어진다',()=>{
 const currentStoneSurface=structuredClone(currentBridgeSurface);
 currentStoneSurface.bridges[0].material='stone';
 currentStoneSurface.elevations[5][6]=2;
 const currentBridgeFaces=[4,5,6].flatMap(currentColumnIndex=>buildFieldCellGeometry({column:currentColumnIndex,row:5},currentStoneSurface,FIELD_RENDER_METRICS));
 const currentArchPanels=currentBridgeFaces.filter(currentFaceRecord=>currentFaceRecord.part==='beam');
 for(const currentArchPanel of currentArchPanels){
  const currentSideOffset=currentArchPanel.points[0].x===projectSurfaceVertex({column:3.5,row:4.58,height:80},FIELD_RENDER_METRICS).x?-.42:.42;
  assert.deepEqual(currentArchPanel.points[3],projectSurfaceVertex({column:3.5,row:5+currentSideOffset,height:(8-8.2)*10},FIELD_RENDER_METRICS));
  assert.deepEqual(currentArchPanel.points[2],projectSurfaceVertex({column:6.5,row:5+currentSideOffset,height:(8-6.2)*10},FIELD_RENDER_METRICS));
 }
});

test('석교 진입 타일의 난간과 상판도 본체와 같은 깊이 기준을 사용한다',()=>{
 const currentStoneSurface=structuredClone(currentBridgeSurface);
 currentStoneSurface.bridges[0].material='stone';
 for(const currentRotationValue of [0,1,2,3]){
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  const currentSpanFaces=buildBridgeCellGeometry({column:5,row:5},currentStoneSurface,currentRenderOptions);
  const currentArchAnchor=currentSpanFaces.find(currentPanelFace=>currentPanelFace.part==='beam').depthAnchor;
  for(const currentEndColumn of [3,7]){
   const currentEntryFaces=buildBridgeCellGeometry({column:currentEndColumn,row:5},currentStoneSurface,currentRenderOptions);
   assert.ok(currentEntryFaces.every(currentPanelFace=>JSON.stringify(currentPanelFace.depthAnchor)===JSON.stringify(currentArchAnchor)));
   assert.ok(currentEntryFaces.filter(currentPanelFace=>['deck','rail'].includes(currentPanelFace.part)).every(currentPanelFace=>currentPanelFace.structureLayer>1));
  }
 }
});

test('석교의 매립 날개벽은 하단 지형 측면에 중복 투영하지 않는다',()=>{
 const currentStoneSurface=structuredClone(currentBridgeSurface);
 currentStoneSurface.bridges[0].material='stone';
 for(const currentRotationValue of [0,1,2,3])for(const currentEndColumn of [3,7]){
  const currentEntryFaces=buildBridgeCellGeometry({column:currentEndColumn,row:5},currentStoneSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationValue});
  assert.ok(currentEntryFaces.filter(currentPanelFace=>currentPanelFace.part==='abutment').length<=1);
  assert.equal(currentEntryFaces.filter(currentPanelFace=>currentPanelFace.part==='rail').length,2);
  assert.equal(currentEntryFaces.filter(currentPanelFace=>currentPanelFace.part==='deck').length,1);
 }
});

test('육지 뒤쪽 교대 면이 앞쪽 지형 측벽을 덮지 않는다',()=>{
 const currentStoneSurface=structuredClone(currentBridgeSurface);
 currentStoneSurface.bridges[0].material='stone';
 assert.equal(buildBridgeCellGeometry({column:7,row:5},currentStoneSurface,FIELD_RENDER_METRICS).filter(currentPanelFace=>currentPanelFace.part==='abutment').length,0);
 assert.equal(buildBridgeCellGeometry({column:3,row:5},currentStoneSurface,FIELD_RENDER_METRICS).filter(currentPanelFace=>currentPanelFace.part==='abutment').length,1);
});

test('교대 매립면과 뒷면 제외는 목교와 석교에 공통 적용한다',()=>{
 for(const currentMaterialName of ['timber','stone'])for(const currentRotationValue of [0,1,2,3]){
  const currentTestSurface=structuredClone(currentBridgeSurface);
  currentTestSurface.bridges[0].material=currentMaterialName;
  const currentEndFaces=[3,7].map(currentEndColumn=>buildBridgeCellGeometry({column:currentEndColumn,row:5},currentTestSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationValue}));
  assert.deepEqual(currentEndFaces.map(currentPanelFaces=>currentPanelFaces.filter(currentPanelFace=>currentPanelFace.part==='abutment').length).sort(),[0,1]);
 }
});
test('목교 측면 아치는 경간 전체에서 두 면만 생성한다',()=>{
 const currentBeamFaces=[4,5,6].flatMap(currentColumnIndex=>buildBridgeCellGeometry({column:currentColumnIndex,row:5},currentBridgeSurface,FIELD_RENDER_METRICS)).filter(currentPanelFace=>currentPanelFace.part==='beam');
 const currentFaceKeys=currentBeamFaces.map(currentPanelFace=>JSON.stringify(currentPanelFace.points));
 assert.equal(new Set(currentFaceKeys).size,currentFaceKeys.length);
 assert.equal(currentBeamFaces.length,2);
});
test('목교 난간도 내부 접합 기둥은 절반씩 사용한다',()=>{
 const currentRailFaces=buildBridgeCellGeometry({column:5,row:5},currentBridgeSurface,FIELD_RENDER_METRICS).filter(currentPanelFace=>currentPanelFace.part==='rail');
 assert.ok(currentRailFaces.every(currentPanelFace=>currentPanelFace.uvCorners[0]===.05&&currentPanelFace.uvCorners[2]===.95));
});

test('목교와 석교는 네 회전에서 동일한 아치·접지·상판 형상을 공유한다',()=>{
 for(const currentRotationValue of [0,1,2,3])for(const currentColumnIndex of [3,4,5,6,7]){
  const currentStoneSurface=structuredClone(currentBridgeSurface);
  currentStoneSurface.bridges[0].material='stone';
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  const currentShapeFields=currentPanelFace=>({part:currentPanelFace.part,points:currentPanelFace.points,depthOffset:currentPanelFace.depthOffset,depthAnchor:currentPanelFace.depthAnchor,structureLayer:currentPanelFace.structureLayer});
  assert.deepEqual(buildBridgeCellGeometry({column:currentColumnIndex,row:5},currentBridgeSurface,currentRenderOptions).map(currentShapeFields),buildBridgeCellGeometry({column:currentColumnIndex,row:5},currentStoneSurface,currentRenderOptions).map(currentShapeFields));
 }
});

test('목교와 석교 아치의 투명 외곽을 제외하고 하단은 실체 픽셀에 매핑한다',()=>{
 for(const currentMaterialName of ['timber','stone']){
  const currentMapSurface=structuredClone(currentBridgeSurface);
  currentMapSurface.bridges[0].material=currentMaterialName;
  const currentArchFaces=buildBridgeCellGeometry({column:5,row:5},currentMapSurface,FIELD_RENDER_METRICS).filter(currentPanelFace=>currentPanelFace.part==='beam');
  assert.equal(currentArchFaces.length,2);
  for(const currentArchFace of currentArchFaces){
   assert.equal(currentArchFace.uvCorners[0],.02);
   assert.equal(currentArchFace.uvCorners[2],.98);
   assert.equal(currentArchFace.uvCorners[5],617/1254);
  }
 }
});
