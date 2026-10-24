import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAssetListModule,buildMaterialFrameModule} from '../scripts/asset-list-module.mjs';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildBillboardShadowPolygon,drawBillboardContactShadow,resolveFieldSceneryDepth,resolveMapRenderOptions,buildFieldCliffTextureLayers,resolveFieldSceneryPlacement,drawFieldSceneryObject,buildFieldMaterialEdges,drawFieldAuraPanel,buildFieldRoadEdges,drawFieldElevationOutline,buildFieldElevationEdges,buildFieldCellGeometry,buildFieldPanelVertices,buildFieldBoundaryPanels,drawFieldActorContactShadow,resolveFieldAuraUvs,resolveFieldSurfaceDepth,FIELD_RENDER_METRICS,FIELD_SAFE_AURA_PROFILE,FIELD_ACTOR_CONTACT_SHADOW_PROFILES,rotateSurfacePosition,projectSurfaceCell} from '../packages/field-renderer/field-renderer.mjs';

const currentNodeRequire=createRequire(import.meta.url);
const PhaserMeshVertex=currentNodeRequire('phaser/src/geom/mesh/Vertex.js');
const PhaserMatrixFour=currentNodeRequire('phaser/src/math/Matrix4.js');
const currentFlatSurface={columns:9,rows:9,elevations:Array.from({length:9},()=>Array(9).fill(0))};

test('높이가 달라도 타일 깊이는 지면 좌표 순서를 유지한다',()=>{
 const currentRaisedSurface={columns:2,rows:2,elevations:[[0,1],[0,0]]};
 const currentFlatDepth=resolveFieldSurfaceDepth({column:1,row:0},currentFlatSurface,FIELD_RENDER_METRICS);
 const currentRaisedDepth=resolveFieldSurfaceDepth({column:1,row:0},currentRaisedSurface,FIELD_RENDER_METRICS);
 const currentRaisedFrontAnchorDepth=resolveFieldSurfaceDepth({column:1.25,row:0.25},currentRaisedSurface,FIELD_RENDER_METRICS);
 const currentFrontDepth=resolveFieldSurfaceDepth({column:1,row:1},currentRaisedSurface,FIELD_RENDER_METRICS);
 assert.equal(currentFlatDepth,200);
 assert.equal(currentRaisedDepth,200);
 assert.equal(currentRaisedFrontAnchorDepth,250);
 assert.ok(currentRaisedDepth<currentFrontDepth);
 currentRaisedSurface.elevations[0][1]=4;
 assert.equal(resolveFieldSurfaceDepth({column:1,row:0},currentRaisedSurface,FIELD_RENDER_METRICS),currentFlatDepth);
});

test('접지 그림자 기본값은 중형 사람의 0.4×0.32 타일 비율을 유지한다',()=>{
 const currentBaselineProfile=FIELD_ACTOR_CONTACT_SHADOW_PROFILES.baseline;
 assert.deepEqual(currentBaselineProfile,{width:0.4,height:0.32,alpha:0.3,coreAlpha:0.24,coreScale:0.65,scale:0.65,opacityScale:1.5});
 assert.ok(FIELD_ACTOR_CONTACT_SHADOW_PROFILES.contrast.alpha>currentBaselineProfile.alpha);
 assert.ok(FIELD_ACTOR_CONTACT_SHADOW_PROFILES.broad.width>currentBaselineProfile.width);
});

test('접지 그림자는 게임과 검수에서 같은 두 겹 타원 계약을 사용한다',()=>{
 const currentDrawingCalls=[];
 const currentMockGraphics={fillStyle:(...currentArguments)=>currentDrawingCalls.push(['style',...currentArguments]),fillEllipse:(...currentArguments)=>currentDrawingCalls.push(['ellipse',...currentArguments])};
  const currentShadowSize=drawFieldActorContactShadow(currentMockGraphics,{x:100,y:200});
 assert.equal(currentShadowSize.color,0x18392e);
 assert.deepEqual(Object.fromEntries(Object.entries(currentShadowSize.outer).map(([currentKey,currentValue])=>[currentKey,Number(currentValue.toFixed(4))])),{width:41.6,height:16.64,alpha:.54});
 assert.deepEqual(Object.fromEntries(Object.entries(currentShadowSize.core).map(([currentKey,currentValue])=>[currentKey,Number(currentValue.toFixed(4))])),{width:27.04,height:10.816,alpha:.45});
 assert.deepEqual(currentDrawingCalls.map(currentDrawingCall=>[currentDrawingCall[0],currentDrawingCall[1],...currentDrawingCall.slice(2).map(currentValue=>typeof currentValue==='number'?Number(currentValue.toFixed(4)):currentValue)]),[['style',0x18392e,.54],['ellipse',100,200,41.6,16.64],['style',0x18392e,.45],['ellipse',100,200,27.04,10.816]]);
 assert.throws(()=>drawFieldActorContactShadow(currentMockGraphics,{x:0,y:0},'missing'));
});

test('결계 패널은 Phaser 실제 직교 투영 후에도 엣지 전체 너비와 위쪽 15px을 유지한다',()=>{
 const currentBoundaryPanels=buildFieldBoundaryPanels({column:4,row:4},{column:4,row:4},0,{x:500,y:400});
 for(const currentPanelPoints of currentBoundaryPanels){
  assert.equal(currentPanelPoints[3].y-currentPanelPoints[0].y,15);
  assert.equal(currentPanelPoints[2].y-currentPanelPoints[1].y,15);
  const currentPanelGeometry=buildFieldPanelVertices(currentPanelPoints);
  for(const [currentViewportWidth,currentViewportHeight] of [[800,600],[1260,1034]]){
   const currentProjectionMatrix=new PhaserMatrixFour().ortho(-currentViewportWidth,currentViewportWidth,-currentViewportHeight,currentViewportHeight,-1000,1000);
   for(const [currentVertexIndex,currentCornerIndex] of [0,1,2,0,2,3].entries()){
    const currentMeshVertex=new PhaserMeshVertex(currentPanelGeometry.vertices[currentVertexIndex*2],currentPanelGeometry.vertices[currentVertexIndex*2+1],0,0,0);
    currentMeshVertex.transformCoordinatesLocal(currentProjectionMatrix,currentViewportWidth,currentViewportHeight,0);
    assert.ok(Math.abs(currentMeshVertex.vx+currentPanelGeometry.center.x-currentPanelPoints[currentCornerIndex].x)<.001);
    assert.ok(Math.abs(currentMeshVertex.vy+currentPanelGeometry.center.y-currentPanelPoints[currentCornerIndex].y)<.001);
   }
  }
 }
});

test('반경 3 결계는 4방향 회전 모두 외곽 28개 엣지만 가진다',()=>{
 const currentSafeCenter={column:4,row:4};
 for(let currentRotationValue=0;currentRotationValue<4;currentRotationValue++){
  let currentPanelCount=0;
  for(let currentRowValue=0;currentRowValue<9;currentRowValue++)for(let currentColumnValue=0;currentColumnValue<9;currentColumnValue++){
   const currentCellPosition={column:currentColumnValue,row:currentRowValue};
   const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
   const currentPanelRecords=buildFieldBoundaryPanels(rotateSurfacePosition(currentCellPosition,currentRotationValue),rotateSurfacePosition(currentSafeCenter,currentRotationValue),3,projectSurfaceCell(currentCellPosition,currentFlatSurface,currentRenderOptions),currentRenderOptions);
   currentPanelCount+=currentPanelRecords.length;
   if(Math.abs(currentColumnValue-4)+Math.abs(currentRowValue-4)<3)assert.equal(currentPanelRecords.length,0);
  }
  assert.equal(currentPanelCount,28);
 }
});

test('오러 8프레임 UV가 각 셀 안에 있고 투영된 지면·계단은 유한 좌표를 갖는다',()=>{
 for(let currentFrameIndex=0;currentFrameIndex<FIELD_SAFE_AURA_PROFILE.frames;currentFrameIndex++){
  const currentFrameUvs=resolveFieldAuraUvs(currentFrameIndex,1774,887);
  assert.equal(currentFrameUvs.length,8);
  assert.ok(currentFrameUvs.every(currentUvValue=>currentUvValue>=0&&currentUvValue<=1));
  assert.ok(currentFrameUvs[2]>currentFrameUvs[0]);assert.ok(currentFrameUvs[5]>currentFrameUvs[1]);
  // 시트의 외부 여백이 수직 패널 밑변과 이웃 엣지 사이에 끼지 않는다.
  const currentFrameColumn=currentFrameIndex%4,currentFrameRow=Math.floor(currentFrameIndex/4);
  assert.ok(currentFrameUvs[0]>currentFrameColumn/4);
  assert.ok(currentFrameUvs[2]<(currentFrameColumn+1)/4);
  assert.ok(currentFrameUvs[1]>currentFrameRow/2);
  assert.ok(currentFrameUvs[5]<(currentFrameRow+1)/2);
 }
 assert.throws(()=>resolveFieldAuraUvs(8,1774,887));
 const currentStairSurface={columns:2,rows:2,elevations:[[0,0],[1,1]],elevationTiles:[{cell:{column:1,row:1},lower:{column:1,row:0}}]};
 for(let currentRotationValue=0;currentRotationValue<4;currentRotationValue++){
  const currentFaceRecords=buildFieldCellGeometry({column:1,row:1},currentStairSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationValue});
  assert.equal(currentFaceRecords.filter(currentFaceRecord=>currentFaceRecord.kind==='tread').length,0);
  assert.ok(currentFaceRecords.flatMap(currentFaceRecord=>currentFaceRecord.points).every(currentPointValue=>Number.isFinite(currentPointValue.x)&&Number.isFinite(currentPointValue.y)));
 }
});

test('높은 평면의 단차 모서리만 표시하고 평면 내부는 제외하고 계단 접합부는 포함한다',()=>{
 const currentRaisedSurface={columns:3,rows:3,elevations:[[0,0,0],[0,1,1],[0,0,0]]};
 const currentUpperEdges=buildFieldElevationEdges({column:1,row:1},currentRaisedSurface);
 assert.equal(currentUpperEdges.length,3);
 assert.deepEqual(buildFieldElevationEdges({column:0,row:0},currentRaisedSurface),[]);
 assert.deepEqual(buildFieldElevationEdges({column:1,row:1},{columns:3,rows:3,elevations:Array.from({length:3},()=>[1,1,1])}),[]);
 const currentStairSurface={...currentRaisedSurface,elevationTiles:[{cell:{column:1,row:1},lower:{column:1,row:0},kind:'stairs'}]};
 assert.deepEqual(buildFieldElevationEdges({column:1,row:1},currentStairSurface),currentUpperEdges);
 assert.equal(buildFieldElevationEdges({column:2,row:1},currentStairSurface).length,2);
 const currentUpperCenter=projectSurfaceCell({column:1,row:1},currentRaisedSurface,FIELD_RENDER_METRICS);
 assert.ok(currentUpperEdges.flat().every(currentPoint=>Math.abs(currentPoint.y-currentUpperCenter.y)<=FIELD_RENDER_METRICS.tileHeight/2));
});


test('윗면 선은 내부 해상도와 확대 배율에 관계없이 화면 4px를 유지하고 정리한다',()=>{
 const currentSceneEvents=new (currentNodeRequire('node:events').EventEmitter)();
 const currentGraphicEvents=new (currentNodeRequire('node:events').EventEmitter)();
 const currentStrokeWidths=[];
 const currentMockGraphic=Object.assign(currentGraphicEvents,{setDepth(){return this;},clear(){},lineStyle(currentLineWidth){currentStrokeWidths.push(currentLineWidth);},lineBetween(){}});
 const currentMockScene={add:{graphics:()=>currentMockGraphic},events:currentSceneEvents,scale:{displayScale:{x:2}},cameras:{main:{zoom:4}}};
 drawFieldElevationOutline(currentMockScene,[[{x:0,y:0},{x:10,y:10}]],1);
 assert.equal(currentStrokeWidths.at(-1)*4/2,4);
 currentSceneEvents.emit('postupdate');assert.equal(currentStrokeWidths.length,1);
 currentMockScene.cameras.main.zoom=2;currentSceneEvents.emit('postupdate');
 assert.equal(currentStrokeWidths.at(-1)*2/2,4);
 currentMockScene.scale.displayScale.x=1;currentSceneEvents.emit('postupdate');
 assert.equal(currentStrokeWidths.at(-1)*2,4);
 currentGraphicEvents.emit('destroy');assert.equal(currentSceneEvents.listenerCount('postupdate'),0);
});


test('도로 연결 끝은 열고 교차점 내부에는 외곽선을 그리지 않는다',()=>{
 const currentRoadCell={column:4,row:4};
 assert.deepEqual(buildFieldRoadEdges(currentRoadCell,currentFlatSurface,15),[]);
 assert.equal(buildFieldRoadEdges(currentRoadCell,currentFlatSurface,5).length,4);
 assert.equal(buildFieldRoadEdges(currentRoadCell,currentFlatSurface,0).length,40);
 for(let currentConnectionMask=0;currentConnectionMask<16;currentConnectionMask++)
  assert.ok(buildFieldRoadEdges(currentRoadCell,currentFlatSurface,currentConnectionMask).flat().every(currentPoint=>Number.isFinite(currentPoint.x)&&Number.isFinite(currentPoint.y)));
});

test('결계 오러는 씬 시간으로 UV를 순환하고 해제 시 애니메이션 구독을 정리한다',()=>{
 const currentSceneEvents=new EventEmitter(),currentMeshEvents=new EventEmitter();
 const currentPanelMesh={width:800,height:600,vertices:Array.from({length:6},()=>({})),setOrtho(){},setDepth(){},setAlpha(){},once:(...currentEventArguments)=>currentMeshEvents.once(...currentEventArguments)};
 const currentGameScene={events:currentSceneEvents,textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:1774,height:887})})},add:{mesh:()=>currentPanelMesh}};
 drawFieldAuraPanel(currentGameScene,[{x:0,y:0},{x:10,y:0},{x:10,y:15},{x:0,y:15}],'aura',1);
 currentSceneEvents.emit('update',0);
 const currentFirstFrame=currentPanelMesh.vertices.map(currentMeshVertex=>[currentMeshVertex.u,currentMeshVertex.v]);
 currentSceneEvents.emit('update',FIELD_SAFE_AURA_PROFILE.frameDuration);
 assert.notDeepEqual(currentPanelMesh.vertices.map(currentMeshVertex=>[currentMeshVertex.u,currentMeshVertex.v]),currentFirstFrame);
 currentSceneEvents.emit('update',FIELD_SAFE_AURA_PROFILE.frameDuration*FIELD_SAFE_AURA_PROFILE.frames);
 assert.deepEqual(currentPanelMesh.vertices.map(currentMeshVertex=>[currentMeshVertex.u,currentMeshVertex.v]),currentFirstFrame);
 currentMeshEvents.emit('destroy');
 assert.equal(currentSceneEvents.listenerCount('update'),0);
});

test('측벽 이음선은 제외하고 높이차 끝과 계단 접합부는 유지한다',async()=>{
 const {buildFieldCliffEdges}=await import('../packages/field-renderer/field-renderer.mjs');
 const currentWallSurface={columns:3,rows:2,elevations:[[2,2,2],[0,0,0]]};
 const currentMiddleCell={column:1,row:0};
 const currentMiddleFace=buildFieldCellGeometry(currentMiddleCell,currentWallSurface).find(currentFaceRecord=>currentFaceRecord.kind==='cliff');
 assert.equal(buildFieldCliffEdges(currentMiddleCell,currentWallSurface,currentMiddleFace.points).length,2);
 const currentStairSurface={...currentWallSurface,elevationTiles:[{cell:{column:2,row:0},lower:{column:2,row:1}}]};
 assert.equal(buildFieldCliffEdges(currentMiddleCell,currentStairSurface,currentMiddleFace.points).length,2);
 const currentPartialSurface={...currentWallSurface,elevations:[[1,2,2],[0,0,0]]};
 assert.equal(buildFieldCliffEdges(currentMiddleCell,currentPartialSurface,currentMiddleFace.points).length,3);
});

test('바닥·도로 재질 경계는 같은 높이에서 한 번 표시하고 단차와 중복하지 않는다',()=>{
 const currentMapSurface={columns:2,rows:2,elevations:[[0,0],[0,0]]};
 const resolveGroundMaterial=currentCellPosition=>currentCellPosition.column===0?'grass':'flowers';
 assert.equal(buildFieldMaterialEdges({column:0,row:0},currentMapSurface,resolveGroundMaterial).length,0);
 assert.equal(buildFieldMaterialEdges({column:1,row:0},currentMapSurface,resolveGroundMaterial).length,1);
 assert.equal(buildFieldMaterialEdges({column:1,row:1},currentMapSurface,()=> 'grass').length,0);
 assert.equal(buildFieldMaterialEdges({column:1,row:0},currentMapSurface,currentCellPosition=>currentCellPosition.column?'road':'grass').length,1);
 assert.equal(buildFieldMaterialEdges({column:1,row:0},{...currentMapSurface,elevations:[[0,1],[0,1]]},resolveGroundMaterial).length,0);
 for(const currentRotationValue of [0,1,2,3])assert.ok(buildFieldMaterialEdges({column:1,row:0},currentMapSurface,resolveGroundMaterial,{...FIELD_RENDER_METRICS,rotation:currentRotationValue}).flat().every(currentPoint=>Number.isFinite(currentPoint.x)&&Number.isFinite(currentPoint.y)));
});

test('같은 지형 코드는 모든 필드에서 같은 재질을 선택한다',async()=>{
 const {build}=await import('esbuild');
 const {outputFiles}=await build({entryPoints:['src/game/terrain/fieldTileRendering.ts'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty','.webp':'empty'},plugins:[{name:'texture-test',setup(currentBuildContext){
 currentBuildContext.onLoad({filter:/field-material-frames\.yaml$/},async currentModuleArguments=>({contents:buildMaterialFrameModule(await readFile(currentModuleArguments.path,'utf8')),loader:'js'}));
 currentBuildContext.onLoad({filter:/\.asset-list\.yaml$/},async currentModuleArguments=>({contents:buildAssetListModule(await readFile(currentModuleArguments.path,'utf8'),resolve('../slime-assets')),loader:'js'}));
 }}]});
 const {resolveFieldTileTextures}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
 // 프레임 이름이 달라도 같은 원본이면 평지의 경계가 없어야 한다. 단차는 별도 유지한다.
 const currentSourceScene={textures:{exists:()=>true,get:currentTextureKey=>({getSourceImage:()=>({src:currentTextureKey.includes('grass')?'grass.png':'rock.png'})})}};
 const currentAliasReader=currentCellPosition=>['stone','fractured-bedrock','angular-quarry-scree'][currentCellPosition.column];
 const currentResolvedTextures=resolveFieldTileTextures(currentSourceScene,'stone',{column:1,row:1},'broken-quarry',0,currentAliasReader);
 assert.deepEqual(buildFieldMaterialEdges({column:1,row:1},currentFlatSurface,currentResolvedTextures.resolveGroundMaterial),[]);
 assert.equal(currentResolvedTextures.resolveGroundMaterial({column:0,row:1}),currentResolvedTextures.resolveGroundMaterial({column:2,row:1}));
 const currentDifferentTextures=resolveFieldTileTextures(currentSourceScene,'stone',{column:1,row:1},'broken-quarry',0,currentCellPosition=>currentCellPosition.column===0?'grass':'stone');
 assert.equal(buildFieldMaterialEdges({column:1,row:1},currentFlatSurface,currentDifferentTextures.resolveGroundMaterial).length,1);
 assert.equal(buildFieldElevationEdges({column:1,row:1},{columns:3,rows:3,elevations:[[0,0,0],[0,2,0],[0,0,0]]}).length,4);
 const currentMaterialReader=()=> 'grass';
 for(const currentMapIdentifier of ['meadow','broken-quarry','ash-edge','wind-hills','old-orchard','granary-flats']){
  for(const [currentTerrainName,currentExpectedFrame] of [['battle-rock-a','battle-rock-a'],['battle-rock-b','battle-rock-b'],['battle-rock-c','battle-rock-c'],['battle-thicket','battle-thicket'],['road','road'],['dirt-road','dirt-road'],['stone-road','stone-road'],['flowers','flowers'],['wind-swept-grass','wind-swept-grass-v1'],['golden-grain-field','golden-grain-field-v1'],['fallen-orchard-fruit','fallen-orchard-fruit-v1']]){
   assert.equal(resolveFieldTileTextures(currentSourceScene,currentTerrainName,{column:0,row:0},currentMapIdentifier,5,currentMaterialReader).ground,'terrain-source-'+currentExpectedFrame);
  }
 }

});


test('지형지물은 타일 중심 접지와 깊이를 공유하고 결계타워도 같은 진입점을 사용한다',()=>{
 const currentRecordedImages=[];
 const currentMockScene={textures:{exists:currentTextureKey=>['tree-sprite','tower-sprite'].includes(currentTextureKey)},add:{graphics:()=>({setDepth(){return this;},fillStyle(){},fillPoints(){},fillEllipse(){},destroy(){}}),image(currentPositionX,currentPositionY,currentTextureKey){
  const currentImageRecord={x:currentPositionX,y:currentPositionY,key:currentTextureKey,width:200,height:300,
   once(){return this;},setData(currentDataKey,currentDataValue){this[currentDataKey]=currentDataValue;return this;},
   setOrigin(currentAnchorX,currentAnchorY){this.origin=[currentAnchorX,currentAnchorY];return this;},
   setScale(currentScaleValue){this.scale=currentScaleValue;return this;},
   setDepth(currentDepthValue){this.depth=currentDepthValue;return this;}};
  currentRecordedImages.push(currentImageRecord);return currentImageRecord;
 }}};
 const currentObjectRecord={id:'tree-1',kind:'decoration',position:{column:2,row:3},textureKey:'tree-sprite',displayHeight:120,anchorX:.5,anchorY:.9};
 const currentRenderedTree=drawFieldSceneryObject(currentMockScene,currentObjectRecord,{x:80,y:60},31);
 assert.deepEqual([currentRenderedTree.x,currentRenderedTree.y,currentRenderedTree.scale,currentRenderedTree.depth],[80,60,.4,31]);
 const currentOutdoorOptions=resolveMapRenderOptions({renderKind:'field'});
 const currentOutdoorTree=drawFieldSceneryObject(currentMockScene,currentObjectRecord,{x:80,y:60},31,undefined,currentOutdoorOptions);
 assert.equal(currentOutdoorTree.scale,.2);
 assert.deepEqual(currentOutdoorTree.origin,[.5,.9]);
 assert.equal(currentObjectRecord.displayHeight,120);
 assert.throws(()=>drawFieldSceneryObject(currentMockScene,currentObjectRecord,{x:80,y:60},31,undefined,{billboardScale:0}),/배율/);
 assert.deepEqual(currentRenderedTree.origin,[.5,.9]);
 assert.deepEqual(currentRenderedTree.sceneryGroundPosition,{column:2,row:3});
 const currentRenderedTower=drawFieldSceneryObject(currentMockScene,{id:'tower',kind:'ward-tower',position:{column:0,row:0}},{x:10,y:20},5,'tower-sprite');
 assert.equal(currentRenderedTower.key,'tower-sprite');
 assert.equal(currentRenderedTower.depth,5);
 assert.throws(()=>drawFieldSceneryObject(currentMockScene,{...currentObjectRecord,textureKey:'missing'},{x:0,y:0},1),/텍스처 누락/);
});


test('타일 3점 앵커는 고도 중심을 유지하고 네 방향 회전과 깊이 좌표를 반영한다',()=>{
 const currentAnchorCases=[['back',0,-10],['center',0,0],['front',0,10]];
 const currentObjectRecord={id:'tree',kind:'ward-tower',position:{column:4,row:6}};
 for(const [currentAnchorName,currentOffsetX,currentOffsetY] of currentAnchorCases){
  const currentPlacement=resolveFieldSceneryPlacement({...currentObjectRecord,tileAnchor:currentAnchorName},{x:100,y:-200},{tileWidth:80,tileHeight:40});
  assert.deepEqual(currentPlacement.screen,{x:100+currentOffsetX,y:-200+currentOffsetY});
 }
 const currentRotatedOffsets=[[0,10],[-20,0],[0,-10],[20,0]];
 for(let currentRotationIndex=0;currentRotationIndex<4;currentRotationIndex++){
  const currentPlacement=resolveFieldSceneryPlacement({...currentObjectRecord,tileAnchor:'front'},{x:100,y:-200},{tileWidth:80,tileHeight:40,rotation:currentRotationIndex});
  assert.deepEqual(currentPlacement.position,{column:4.25,row:6.25});
  assert.deepEqual(currentPlacement.screen,{x:100+currentRotatedOffsets[currentRotationIndex][0],y:-200+currentRotatedOffsets[currentRotationIndex][1]});
 }
 assert.deepEqual(resolveFieldSceneryPlacement(currentObjectRecord,{x:1,y:2}).screen,{x:1,y:2});
 assert.throws(()=>resolveFieldSceneryPlacement({...currentObjectRecord,tileAnchor:'unknown'},{x:0,y:0}),/타일 앵커/);
});


test('수풀 두 프레임은 동일 위치에서 캐릭터 깊이를 사이에 두고 그린다',()=>{
 const currentFrameRecords=new Map();
 const currentTextureRecord={getSourceImage:()=>({width:256,height:128}),has:currentFrameName=>currentFrameRecords.has(currentFrameName),add:(...currentFrameArguments)=>currentFrameRecords.set(currentFrameArguments[0],currentFrameArguments.slice(1))};
 const currentMockScene={textures:{exists:()=>true,get:()=>currentTextureRecord},add:{graphics:()=>({setDepth(){return this;},fillStyle(){},fillPoints(){},fillEllipse(){},destroy(){}}),image:(currentPositionX,currentPositionY,currentTextureKey,currentFrameName)=>({x:currentPositionX,y:currentPositionY,frame:currentFrameName,once(){return this;},setData(currentDataKey,currentDataValue){this[currentDataKey]=currentDataValue;return this;},setOrigin(...currentOriginValues){this.origin=currentOriginValues;return this;},setScale(currentScaleValue){this.scale=currentScaleValue;return this;},setDepth(currentDepthValue){this.depth=currentDepthValue;return this;}})}};
 const currentObjectRecord={position:{column:1,row:1},kind:'billboard',textureKey:'bush',frameSize:128,displayHeight:80,anchorX:.5,anchorY:.65};
 const currentLayerImages=drawFieldSceneryObject(currentMockScene,currentObjectRecord,{x:100,y:200},110);
 const currentOutdoorLayers=drawFieldSceneryObject(currentMockScene,currentObjectRecord,{x:100,y:200},110,undefined,resolveMapRenderOptions({renderKind:'field'}));
 assert.deepEqual(currentOutdoorLayers.map(currentLayerImage=>currentLayerImage.scale),[.3125,.3125]);
 assert.equal(currentObjectRecord.displayHeight,80);
 assert.equal(currentLayerImages.length,2);
 assert.deepEqual(currentLayerImages.map(currentLayerImage=>[currentLayerImage.x,currentLayerImage.y,currentLayerImage.scale,currentLayerImage.origin]),[[100,200,.625,[.5,.65]],[100,200,.625,[.5,.65]]]);
 assert.ok(currentLayerImages[0].depth<120&&currentLayerImages[1].depth>120);
 for(const currentAnchorName of ['top','bottom']){
  const currentAnchoredObject={...currentObjectRecord,billboardPlacementAnchor:currentAnchorName};
  const currentAnchoredDepth=resolveFieldSceneryDepth(currentAnchoredObject,currentFlatSurface);
  const currentAnchoredLayers=drawFieldSceneryObject(currentMockScene,currentAnchoredObject,{x:100,y:200},currentAnchoredDepth);
  const currentActorDepth=resolveFieldSurfaceDepth(currentObjectRecord.position,currentFlatSurface)+20;
  assert.ok(currentAnchoredLayers.every(currentLayerImage=>currentAnchorName==='top'?currentLayerImage.depth<currentActorDepth:currentLayerImage.depth>currentActorDepth));
 }

 assert.deepEqual([...currentFrameRecords.values()],[[0,0,0,128,128],[0,128,0,128,128]]);
 assert.throws(()=>drawFieldSceneryObject(currentMockScene,{...currentObjectRecord,frameSize:64},{x:0,y:0},0),/2프레임/);
});

test('빌보드와 겹친 같은 높이 바닥은 뒤에 두고 높은 바닥은 유지한다',async()=>{
 const {resolveBillboardGroundDepth}=await import('../packages/field-renderer/field-renderer.mjs');
 const currentBillboardRecords=[{kind:'billboard',position:{column:3,row:3},tileAnchor:'center',displayHeight:80,anchorX:.5,anchorY:.75}];
 const currentGroundDepth=resolveBillboardGroundDepth({column:4,row:3},currentFlatSurface,FIELD_RENDER_METRICS,800,currentBillboardRecords);
 assert.ok(currentGroundDepth<710);
 const currentRaisedSurface={...currentFlatSurface,elevations:currentFlatSurface.elevations.map(currentHeightRow=>[...currentHeightRow])};
 currentRaisedSurface.elevations[3][4]=1;
 assert.equal(resolveBillboardGroundDepth({column:4,row:3},currentRaisedSurface,FIELD_RENDER_METRICS,800,currentBillboardRecords),800);
 assert.equal(resolveBillboardGroundDepth({column:8,row:8},currentFlatSurface,FIELD_RENDER_METRICS,1700,currentBillboardRecords),1700);
});

test('표시 타일 덮어쓰기를 기준으로 재질 경계를 판정한다',async()=>{
 const {resolveFieldGroundMaterial}=await import('../packages/field-renderer/field-renderer.mjs');
 const currentMapSurface={columns:2,rows:2,elevations:[[0,0],[0,0]],stairs:[]};
 const currentGroundOverrides=[{position:{column:0,row:0},textureKey:'orchard-soil'},{position:{column:1,row:0},textureKey:'orchard-soil'}];
 const resolveDisplayedMaterial=currentCellPosition=>resolveFieldGroundMaterial(currentCellPosition,currentGroundOverrides,currentTerrainPosition=>currentTerrainPosition.column===0?'grass':'moss');
 assert.equal(buildFieldMaterialEdges({column:1,row:0},currentMapSurface,resolveDisplayedMaterial).length,0);
 currentGroundOverrides[1].textureKey='orchard-grass';
 assert.equal(buildFieldMaterialEdges({column:1,row:0},currentMapSurface,resolveDisplayedMaterial).length,1);
});


test('앞쪽에서 배우와 겹치는 지형만 흐리게 하고 이동 후 복원한다',async()=>{
 const {updateFieldActorOcclusion,FIELD_OCCLUSION_ALPHA}=await import('../packages/field-renderer/field-renderer.mjs');
 const currentActorBounds={x:10,y:10,width:10,height:20};
 const currentActorObject={visible:true,depth:10,getBounds:()=>currentActorBounds,getData:currentDataKey=>currentDataKey==='fieldActorVisibility'?true:undefined};
 const createOccludingObject=(currentObjectDepth,currentObjectBounds)=>({visible:true,depth:currentObjectDepth,alpha:.8,getBounds:()=>currentObjectBounds,getData:currentDataKey=>currentDataKey==='fieldOcclusionBaseAlpha'?.8:undefined,setAlpha(currentAlphaValue){this.alpha=currentAlphaValue;}});
 const currentFrontObject=createOccludingObject(11,{x:15,y:15,width:20,height:20});
 const currentBehindObject=createOccludingObject(9,{x:15,y:15,width:20,height:20});
 const currentDistantObject=createOccludingObject(12,{x:80,y:15,width:20,height:20});
 const currentPixelFixture={displayOriginX:0,displayOriginY:0,texture:{key:'fixture'},frame:{name:0},scene:{textures:{getPixelAlpha:()=>255}},getWorldTransformMatrix:()=>({applyInverse:(currentPointColumn,currentPointRow)=>({x:currentPointColumn,y:currentPointRow})})};
 for(const currentTestObject of [currentActorObject,currentFrontObject,currentBehindObject,currentDistantObject])Object.assign(currentTestObject,currentPixelFixture);
 const currentGameScene={children:{list:[currentActorObject,currentFrontObject,currentBehindObject,currentDistantObject]}};
 updateFieldActorOcclusion(currentGameScene);
 assert.equal(currentFrontObject.alpha,.8*FIELD_OCCLUSION_ALPHA);
 assert.equal(currentBehindObject.alpha,.8);
 assert.equal(currentDistantObject.alpha,.8);
 currentFrontObject.scene={textures:{getPixelAlpha:()=>0}};
 updateFieldActorOcclusion(currentGameScene);
 assert.equal(currentFrontObject.alpha,.8,'투명 여백만 겹치면 불투명 유지');
 currentFrontObject.scene=currentPixelFixture.scene;
 currentActorBounds.x=100;
 updateFieldActorOcclusion(currentGameScene);
 assert.equal(currentFrontObject.alpha,.8);
 currentActorObject.visible=false;
 updateFieldActorOcclusion(currentGameScene);
 assert.equal(currentDistantObject.alpha,.8);
});

test('가리지 않는 발 앞 타일과 경계는 불투명을 유지한다',async()=>{
 const {updateFieldActorOcclusion}=await import('../packages/field-renderer/field-renderer.mjs');
 const currentActorObject={visible:true,depth:10,getBounds:()=>({x:-5,y:-20,width:10,height:20}),getData:currentDataKey=>currentDataKey==='fieldActorVisibility'?true:undefined,getWorldTransformMatrix:()=>({transformPoint:()=>({x:0,y:0})})};
 const currentTerrainPolygon=[{x:-10,y:3},{x:10,y:3},{x:10,y:12},{x:-10,y:12}];
 const currentTerrainObject={visible:true,depth:11,alpha:1,getBounds:()=>({x:-10,y:3,width:20,height:9}),getData:currentDataKey=>currentDataKey==='fieldOcclusionBaseAlpha'?1:currentDataKey==='fieldOcclusionPolygon'?currentTerrainPolygon:undefined,setAlpha(currentAlphaValue){this.alpha=currentAlphaValue;}};
 const currentEdgeObject={visible:true,alpha:.7,getData:currentDataKey=>currentDataKey==='fieldOcclusionEdgeSources'?[currentTerrainObject]:currentDataKey==='fieldOcclusionEdgeBaseAlpha'?.7:undefined,setAlpha(currentAlphaValue){this.alpha=currentAlphaValue;}};
 const currentTestScene={children:{list:[currentActorObject,currentTerrainObject,currentEdgeObject]}};
 updateFieldActorOcclusion(currentTestScene);assert.equal(currentTerrainObject.alpha,1);assert.equal(currentEdgeObject.alpha,.7);
 currentTerrainObject.depth=9;updateFieldActorOcclusion(currentTestScene);assert.equal(currentTerrainObject.alpha,1);assert.equal(currentEdgeObject.alpha,.7);
 currentTerrainObject.depth=11;currentTerrainPolygon.forEach(currentPointValue=>currentPointValue.x+=100);
 updateFieldActorOcclusion(currentTestScene);assert.equal(currentTerrainObject.alpha,1);assert.equal(currentEdgeObject.alpha,.7);
});

test('가리는 윗면과 같은 타일 벽면은 40%로 함께 감쇠하고 복원한다',async()=>{
 const {updateFieldActorOcclusion}=await import('../packages/field-renderer/field-renderer.mjs');
 const currentActorBounds={x:0,y:0,width:10,height:10};
 const currentActorObject={visible:true,depth:10,getBounds:()=>currentActorBounds,getData:currentDataKey=>currentDataKey==='fieldActorVisibility'?true:undefined,displayOriginX:0,displayOriginY:0,texture:{key:'actor'},frame:{name:0},scene:{textures:{getPixelAlpha:()=>255}},getWorldTransformMatrix:()=>({applyInverse:(currentPointColumn,currentPointRow)=>({x:currentPointColumn,y:currentPointRow})})};
 const currentCellSources=[];
 for(const currentPanelRow of [5,15])currentCellSources.push({visible:true,depth:11,alpha:1,getBounds:()=>({x:0,y:currentPanelRow,width:10,height:10}),getData:currentDataKey=>({fieldOcclusionBaseAlpha:1,fieldOcclusionCellSources:currentCellSources,fieldOcclusionPolygon:[{x:0,y:currentPanelRow},{x:10,y:currentPanelRow},{x:10,y:currentPanelRow+10},{x:0,y:currentPanelRow+10}]}[currentDataKey]),setAlpha(currentAlphaValue){this.alpha=currentAlphaValue;}});
 const currentTestScene={children:{list:[currentActorObject,...currentCellSources]}};
 updateFieldActorOcclusion(currentTestScene);assert.deepEqual(currentCellSources.map(currentPanelObject=>currentPanelObject.alpha),[.4,.4]);
 currentActorBounds.x=100;updateFieldActorOcclusion(currentTestScene);assert.deepEqual(currentCellSources.map(currentPanelObject=>currentPanelObject.alpha),[1,1]);
});

 test('측벽 무늬는 낮은 벽에서도 압축되지 않고 높은 벽의 마지막 구간만 잘린다',()=>{
  for(const currentWallHeight of [10,16,40,60,95]){
   const currentFacePoints=[{x:0,y:0},{x:40,y:20},{x:40,y:20+currentWallHeight},{x:0,y:currentWallHeight}];
   const currentWallLayers=buildFieldCliffTextureLayers(currentFacePoints,128,128);
   assert.equal(currentWallLayers.length,Math.ceil(currentWallHeight/40));
   for(const currentWallLayer of currentWallLayers){
    const currentLayerHeight=currentWallLayer.points[2].y-currentWallLayer.points[1].y;
    assert.equal(currentLayerHeight/currentWallLayer.uvCorners[5],40);
   }
   assert.equal(currentWallLayers.at(-1).points[2].y,20+currentWallHeight);
  }
  const currentWideSource=buildFieldCliffTextureLayers([{x:0,y:0},{x:-40,y:20},{x:-40,y:50},{x:0,y:30}],256,128);
  assert.equal(currentWideSource.length,2);
  assert.equal(currentWideSource[1].uvCorners[5],.5);
 });

test('공통 타일은 160×80 지면으로 투영한다',()=>{
 assert.equal(FIELD_RENDER_METRICS.tileWidth,160);
 assert.equal(FIELD_RENDER_METRICS.tileHeight,80);
});

test('공용 빌보드 상하 앵커는 기존 중앙값보다 우선하고 타일 Y 끝점에 접지한다',()=>{
 const currentObjectRecord={id:'grass',position:{column:3,row:4},tileAnchor:'center'};
 for(const [currentAnchorName,currentOffsetSign] of [['top',-1],['bottom',1]]){
  for(const currentTileHeight of [40,80]){
   const currentPlacement=resolveFieldSceneryPlacement({...currentObjectRecord,billboardPlacementAnchor:currentAnchorName},{x:100,y:200},{tileWidth:currentTileHeight*2,tileHeight:currentTileHeight});
   assert.deepEqual(currentPlacement.screen,{x:100,y:200+currentOffsetSign*currentTileHeight/2});
   assert.deepEqual(currentPlacement.position,{column:3+currentOffsetSign/2,row:4+currentOffsetSign/2});
  }
 }
});

test('공유 접지점의 앞 타일 빌보드는 배열 순서와 무관하게 뒤 타일을 덮는다',()=>{
 const currentRearObject={position:{column:9,row:14},billboardPlacementAnchor:'bottom'};
 const currentFrontObject={position:{column:10,row:15},billboardPlacementAnchor:'top'};
 for(const currentRotationValue of [0,1,2,3]){
  const currentRenderOptions={...resolveMapRenderOptions({renderKind:'field'}),rotation:currentRotationValue};
  const currentRearPlacement=resolveFieldSceneryPlacement(currentRearObject,{x:0,y:0},currentRenderOptions);
  const currentFrontPlacement=resolveFieldSceneryPlacement(currentFrontObject,{x:0,y:0},currentRenderOptions);
  assert.deepEqual(currentRearPlacement.position,currentFrontPlacement.position);
  const currentOwnerRear=rotateSurfacePosition(currentRearObject.position,currentRotationValue);
  const currentOwnerFront=rotateSurfacePosition(currentFrontObject.position,currentRotationValue);
  const currentOwnerDifference=currentOwnerFront.column+currentOwnerFront.row-currentOwnerRear.column-currentOwnerRear.row;
  const currentDepthDifference=resolveFieldSceneryDepth(currentFrontObject,currentFlatSurface,currentRenderOptions)-resolveFieldSceneryDepth(currentRearObject,currentFlatSurface,currentRenderOptions);
  assert.equal(Math.sign(currentDepthDifference),Math.sign(currentOwnerDifference));
  assert.ok(Math.abs(currentDepthDifference)<300);
 }
 for(const currentObjectOrder of [[currentRearObject,currentFrontObject],[currentFrontObject,currentRearObject]]){
  assert.equal([...currentObjectOrder].sort((currentLeftObject,currentRightObject)=>resolveFieldSceneryDepth(currentLeftObject,currentFlatSurface)-resolveFieldSceneryDepth(currentRightObject,currentFlatSurface)).at(-1),currentFrontObject);
 }
});


test('첨부 구간의 앞 타일 그루터기는 뒤 타일 하단 통나무보다 앞에 그린다',()=>{
 const currentRearObject={position:{column:11,row:11},billboardPlacementAnchor:'bottom'};
 const currentFrontObject={position:{column:11,row:12},billboardPlacementAnchor:'top'};
 for(const currentRotationValue of [0,1,2,3]){
  const currentRenderOptions={...resolveMapRenderOptions({renderKind:'field'}),rotation:currentRotationValue};
  const currentRearOwnerDepth=resolveFieldSurfaceDepth(currentRearObject.position,currentFlatSurface,currentRenderOptions);
  const currentFrontOwnerDepth=resolveFieldSurfaceDepth(currentFrontObject.position,currentFlatSurface,currentRenderOptions);
  const currentRearObjectDepth=resolveFieldSceneryDepth(currentRearObject,currentFlatSurface,currentRenderOptions);
  const currentFrontObjectDepth=resolveFieldSceneryDepth(currentFrontObject,currentFlatSurface,currentRenderOptions);
  assert.equal(Math.sign(currentFrontObjectDepth-currentRearObjectDepth),Math.sign(currentFrontOwnerDepth-currentRearOwnerDepth));
 }
 const currentActorDepth=resolveFieldSurfaceDepth(currentFrontObject.position,currentFlatSurface)+20;
 assert.ok(resolveFieldSceneryDepth(currentFrontObject,currentFlatSurface)<currentActorDepth);
 assert.ok(resolveFieldSceneryDepth({...currentFrontObject,billboardPlacementAnchor:'bottom'},currentFlatSurface)>currentActorDepth);
});

test('빌보드 그림자는 배율·앞뒤 앵커·비활성 옵션을 공유한다',()=>{
 const currentEllipseRecords=[];
 const currentShadowGraphic={setDepth(currentDepthValue){this.depth=currentDepthValue;return this;},fillStyle(){},fillPoints(currentPolygonPoints){currentEllipseRecords.push(measureShadowPolygonBounds(currentPolygonPoints));}};
 const currentMockScene={add:{graphics:()=>currentShadowGraphic}};
 const currentObjectRecord={displayHeight:150,billboardPlacementAnchor:'bottom'};
 drawBillboardContactShadow(currentMockScene,currentObjectRecord,{x:100,y:100},130,{billboardScale:1});
 const currentFullEllipse=currentEllipseRecords[0];assert.ok(currentFullEllipse[1]<100);assert.equal(currentShadowGraphic.depth,101.5);
 currentEllipseRecords.length=0;
 drawBillboardContactShadow(currentMockScene,currentObjectRecord,{x:100,y:100},130,{billboardScale:.5});
 assert.equal(currentEllipseRecords[0][2],currentFullEllipse[2]/2);
 assert.equal(drawBillboardContactShadow(currentMockScene,currentObjectRecord,{x:0,y:0},0,{billboardShadows:false}),null);
});

test('긴 점유 그림자는 열·행 축으로 투영하고 회전·축소한다',()=>{
 const currentOptions={tileWidth:160,tileHeight:80};
 const currentColumnPoints=buildBillboardShadowPolygon(3,1,{x:0,y:0},currentOptions);
 const currentRowPoints=buildBillboardShadowPolygon(1,3,{x:0,y:0},currentOptions);
 const currentCovariance=currentPoints=>currentPoints.reduce((currentSum,currentPoint)=>currentSum+currentPoint.x*currentPoint.y,0);
 assert.ok(currentCovariance(currentColumnPoints)>0);assert.ok(currentCovariance(currentRowPoints)<0);
 const currentRotatedPoints=buildBillboardShadowPolygon(3,1,{x:0,y:0},{...currentOptions,rotation:1});
 assert.ok(currentCovariance(currentRotatedPoints)<0);
 const currentSmallPoints=buildBillboardShadowPolygon(3,1,{x:0,y:0},{tileWidth:80,tileHeight:40});
 assert.deepEqual(currentSmallPoints,currentColumnPoints.map(currentPoint=>({x:currentPoint.x/2,y:currentPoint.y/2})));
 assert.throws(()=>buildBillboardShadowPolygon(0,1,{x:0,y:0},currentOptions),/양의 정수/);
});

test('그림자 중심은 모든 앵커와 회전에서 소속 타일 중앙이다',()=>{
 for(const currentRotationValue of [0,1,2,3])for(const currentAnchorName of ['top','bottom','center','front','back']){
  const currentRenderOptions={tileWidth:80,tileHeight:40,billboardScale:.5,rotation:currentRotationValue};
  const currentObjectRecord={position:{column:2,row:3},displayHeight:80,billboardPlacementAnchor:currentAnchorName};
  const currentTileCenter={x:300,y:200};
  const currentPlacement=resolveFieldSceneryPlacement(currentObjectRecord,currentTileCenter,currentRenderOptions);
  const currentEllipseRecords=[];
  const currentMockScene={add:{graphics:()=>({setDepth(){return this;},fillStyle(){},fillPoints(currentPolygonPoints){currentEllipseRecords.push(measureShadowPolygonBounds(currentPolygonPoints));}})}};
  drawBillboardContactShadow(currentMockScene,currentObjectRecord,currentPlacement.screen,100,currentRenderOptions);
  assert.deepEqual(currentEllipseRecords[0].slice(0,2),[300,200]);
 }
});

test('에셋 그림자 이동과 크기 배율은 타일 중앙 기준으로 적용된다',()=>{
 const currentEllipseRecords=[];
 const currentMockScene={add:{graphics:()=>({setDepth(){return this;},fillStyle(){},fillPoints(currentPolygonPoints){currentEllipseRecords.push(measureShadowPolygonBounds(currentPolygonPoints));}})}};
 drawBillboardContactShadow(currentMockScene,{displayHeight:100,shadowOffsetColumn:1,shadowOffsetRow:0,shadowScaleX:2,shadowScaleY:.25},{x:0,y:0},100,{tileWidth:80,tileHeight:40,billboardScale:.5});
 assert.deepEqual(currentEllipseRecords[0],measureShadowPolygonBounds(buildBillboardShadowPolygon(1,1,{x:40,y:20},{tileWidth:80,tileHeight:40,shadowScaleX:2,shadowScaleY:.25})));
});

test('타일 하단 중앙 앵커는 기존 이미지 위치를 보존하고 배치 선택값을 무시한다',()=>{
 const currentOldRecord={position:{column:2,row:3},anchorX:.3,anchorY:.8,displayHeight:120,billboardPlacementAnchor:'top'};
 const currentNewRecord={...currentOldRecord,billboardAnchorMode:'tile-bottom-center',anchorX:.5+(.5-.3)*120/160,anchorY:(1-.8)*120/80,billboardPlacementAnchor:'bottom'};
 for(const currentScaleValue of [.5,1]){
  const currentRenderOptions={tileWidth:160*currentScaleValue,tileHeight:80*currentScaleValue,billboardScale:currentScaleValue};
  const currentOldPosition=resolveFieldSceneryPlacement(currentOldRecord,{x:100,y:200},currentRenderOptions).screen;
  const currentNewPosition=resolveFieldSceneryPlacement(currentNewRecord,{x:100,y:200},currentRenderOptions).screen;
  assert.ok(Math.abs((currentOldPosition.x-.3*120*currentScaleValue)-(currentNewPosition.x-.5*120*currentScaleValue))<1e-9);
  assert.ok(Math.abs((currentOldPosition.y-.8*120*currentScaleValue)-(currentNewPosition.y-120*currentScaleValue))<1e-9);
 }
});

 test('2×2 그림자는 회전과 배율에 관계없이 점유 네 칸의 중앙에 놓인다',()=>{
 for(const currentRotationValue of [0,1,2,3])for(const currentScaleValue of [.5,1]){
  const currentRenderOptions={tileWidth:160*currentScaleValue,tileHeight:80*currentScaleValue,billboardScale:currentScaleValue,rotation:currentRotationValue};
  const currentObjectRecord={position:{column:2,row:3},displayHeight:150,groundFootprintColumns:2,groundFootprintRows:2,billboardAnchorMode:'tile-bottom-center',anchorX:.35,anchorY:1.2};
  const currentPlacementValue=resolveFieldSceneryPlacement(currentObjectRecord,{x:300,y:200},currentRenderOptions);
  const currentEllipseRecords=[];
  const currentMockScene={add:{graphics:()=>({setDepth(){return this;},fillStyle(){},fillPoints(currentPolygonPoints){currentEllipseRecords.push(measureShadowPolygonBounds(currentPolygonPoints));}})}};
  drawBillboardContactShadow(currentMockScene,currentObjectRecord,currentPlacementValue.screen,100,currentRenderOptions);
  const currentExpectedOffsets=[[0,40],[-80,0],[0,-40],[80,0]][currentRotationValue];
  assert.ok(Math.abs(currentEllipseRecords[0][0]-300-currentExpectedOffsets[0]*currentScaleValue)<1e-9);
  assert.ok(Math.abs(currentEllipseRecords[0][1]-200-currentExpectedOffsets[1]*currentScaleValue)<1e-9);
 }
});


test('2×1 그림자는 행 방향을 두 배로 늘리지 않는다',()=>{
 const currentShadowPoints=buildBillboardShadowPolygon(2,1,{x:0,y:0},{tileWidth:160,tileHeight:80});
 const currentColumnValues=currentShadowPoints.map(currentPointValue=>currentPointValue.x/160+currentPointValue.y/80);
 const currentRowValues=currentShadowPoints.map(currentPointValue=>currentPointValue.y/80-currentPointValue.x/160);
 assert.ok(Math.abs(Math.max(...currentColumnValues)-Math.min(...currentColumnValues)-2)<1e-10);
 assert.ok(Math.abs(Math.max(...currentRowValues)-Math.min(...currentRowValues)-1)<1e-10);
});

// 수동 앵커 이동은 그림자 원점을 이동시키지 않는다.
for(const currentTileCount of [1,2,3]){
 const currentIntersectionDistance=currentTileCount===1?.5:currentTileCount-1;
 const currentObjectRecord={position:{column:0,row:0},groundFootprintColumns:currentTileCount,groundFootprintRows:currentTileCount,displayHeight:100,billboardAnchorMode:'tile-intersection',anchorX:.2,anchorY:-.3};
 const currentPlacementRecord=resolveFieldSceneryPlacement(currentObjectRecord,{x:0,y:0},{tileWidth:160,tileHeight:80});
 assert.ok(Math.abs(currentPlacementRecord.screen.x-32)<1e-8);
 assert.ok(Math.abs(currentPlacementRecord.screen.y-(currentIntersectionDistance-.3)*80)<1e-8);
 const currentShadowCenters=[];
 const currentGraphicsRecord={setDepth(){return this;},fillStyle(){},fillPoints(currentPolygonPoints){currentShadowCenters.push(measureShadowPolygonBounds(currentPolygonPoints).slice(0,2));}};
 drawBillboardContactShadow({add:{graphics:()=>currentGraphicsRecord}},currentObjectRecord,currentPlacementRecord.screen,0,{tileWidth:160,tileHeight:80});
 for(const currentShadowCenter of currentShadowCenters){assert.ok(Math.abs(currentShadowCenter[0])<1e-8);assert.ok(Math.abs(currentShadowCenter[1]-currentIntersectionDistance*80)<1e-8);}
}

test('여러 칸 그림자는 각 지면 깊이에서 이어지고 다른 고도에는 투영하지 않는다',()=>{
 for(const currentFootprintSize of [[2,1],[1,2],[2,2]])for(const currentRotationValue of [0,1,2,3]){
  const currentMapSurface={columns:7,rows:7,elevations:Array.from({length:7},()=>Array(7).fill(0))};
  const currentObjectRecord={position:{column:3,row:3},displayHeight:300,anchorX:0,anchorY:0,billboardAnchorMode:'tile-intersection',groundFootprintColumns:currentFootprintSize[0],groundFootprintRows:currentFootprintSize[1],shadowScaleX:1.8,shadowScaleY:1.8};
  const currentRenderOptions={tileWidth:80,tileHeight:40,billboardScale:.5,rotation:currentRotationValue,shadowSurface:currentMapSurface};
  const currentPlacementValue=resolveFieldSceneryPlacement(currentObjectRecord,{x:0,y:0},currentRenderOptions);
  const currentGraphicRecords=[];
  const currentMockScene={add:{graphics(){const currentGraphicRecord={polygons:[],setDepth(currentDepthValue){this.depth=currentDepthValue;return this;},fillStyle(){},fillPoints(currentPointValues){this.polygons.push(currentPointValues);},destroy(){this.destroyed=true;}};currentGraphicRecords.push(currentGraphicRecord);return currentGraphicRecord;}}};
  const currentShadowHandle=drawBillboardContactShadow(currentMockScene,currentObjectRecord,currentPlacementValue.screen,100,currentRenderOptions);
  assert.ok(currentGraphicRecords.length>1,'시작 셀 이외의 그림자도 그린다');
  assert.ok(new Set(currentGraphicRecords.map(currentGraphicRecord=>currentGraphicRecord.depth)).size>1,'앞 셀의 지면보다 앞에 그린다');
  const calculatePolygonArea=currentPointValues=>Math.abs(currentPointValues.reduce((currentAreaValue,currentPointValue,currentPointIndex)=>{const currentNextPoint=currentPointValues[(currentPointIndex+1)%currentPointValues.length];return currentAreaValue+currentPointValue.x*currentNextPoint.y-currentNextPoint.x*currentPointValue.y;},0))/2;
  const currentFullArea=currentGraphicRecords.reduce((currentAreaValue,currentGraphicRecord)=>currentAreaValue+calculatePolygonArea(currentGraphicRecord.polygons[0]),0);
  assert.ok(currentFullArea>1000,'다중 타일 면적이 보존된다');
  currentShadowHandle.destroy();assert.ok(currentGraphicRecords.every(currentGraphicRecord=>currentGraphicRecord.destroyed));
  currentMapSurface.elevations[3][4]=5;currentGraphicRecords.length=0;
  drawBillboardContactShadow(currentMockScene,currentObjectRecord,currentPlacementValue.screen,100,currentRenderOptions);
  const currentClippedArea=currentGraphicRecords.reduce((currentAreaValue,currentGraphicRecord)=>currentAreaValue+calculatePolygonArea(currentGraphicRecord.polygons[0]),0);
  assert.ok(currentClippedArea<currentFullArea,'고도가 다른 셀로 그림자가 번지지 않는다');
 }
});


test('고지대는 카메라 앞쪽일 때만 저지대 빌보드를 가린다',()=>{
 const currentMapSurface={columns:32,rows:32,elevations:Array.from({length:32},()=>Array(32).fill(0))};
 const currentRenderOptions={...FIELD_RENDER_METRICS,tileWidth:80,tileHeight:40,billboardScale:.5};
 const currentCases=[
  {object:{position:{column:22,row:11},groundFootprintColumns:2,groundFootprintRows:3,anchorX:.26,anchorY:1.15,displayHeight:352},terrain:{column:24,row:12},height:5,behind:false},
  {object:{position:{column:11,row:14},groundFootprintColumns:1,groundFootprintRows:2,anchorX:-.019,anchorY:.23,displayHeight:330},terrain:{column:10,row:15},height:3,behind:true},
  {object:{position:{column:11,row:6},groundFootprintColumns:3,groundFootprintRows:1,anchorX:-.25,anchorY:.37,displayHeight:360},terrain:{column:13,row:5},height:8,behind:true},
 ];
 for(const currentCaseRecord of currentCases){
  currentMapSurface.elevations[currentCaseRecord.terrain.row][currentCaseRecord.terrain.column]=currentCaseRecord.height;
  const currentObjectRecord={...currentCaseRecord.object,kind:'decoration',billboardAnchorMode:'tile-intersection'};
  const currentObjectDepth=resolveFieldSceneryDepth(currentObjectRecord,currentMapSurface,currentRenderOptions);
  const currentTerrainDepth=resolveFieldSurfaceDepth(currentCaseRecord.terrain,currentMapSurface,currentRenderOptions);
  assert.equal(currentTerrainDepth<currentObjectDepth,currentCaseRecord.behind);
  currentMapSurface.elevations[currentCaseRecord.terrain.row][currentCaseRecord.terrain.column]=0;
 }
});


test('PNG 여백 보정은 빌보드 접지 깊이와 앞뒤 순서를 바꾸지 않는다',()=>{
 const currentRearObject={kind:'decoration',position:{column:23,row:12},billboardAnchorMode:'tile-intersection',groundFootprintColumns:2,groundFootprintRows:1,anchorX:0,anchorY:.4686,displayHeight:314.65};
 for(const currentRotationValue of [0,1,2,3]){
  const currentRenderOptions={...FIELD_RENDER_METRICS,rotation:currentRotationValue};
  const currentOriginalDepth=resolveFieldSceneryDepth(currentRearObject,currentFlatSurface,currentRenderOptions);
  for(const currentPaddingOffset of [0,.2,1.2971,2]){
   assert.equal(resolveFieldSceneryDepth({...currentRearObject,anchorY:currentPaddingOffset},currentFlatSurface,currentRenderOptions),currentOriginalDepth);
  }
 }
 const currentFrontObject={...currentRearObject,position:{column:23,row:13},anchorY:0};
 assert.ok(resolveFieldSceneryDepth(currentFrontObject,currentFlatSurface)>resolveFieldSceneryDepth({...currentRearObject,anchorY:2},currentFlatSurface));
});

test('긴 판형의 앞 행에 있는 작은 파편은 판형의 먼 끝 기준점보다 먼저 그려지지 않는다',()=>{
 const currentLongObject={id:'long',kind:'decoration',position:{column:22,row:13},billboardAnchorMode:'tile-intersection',groundFootprintColumns:3,groundFootprintRows:1,anchorX:-.2465,anchorY:1.2971,displayHeight:415.06};
 const currentFrontObject={id:'front',kind:'decoration',position:{column:22,row:14},billboardAnchorMode:'tile-intersection',groundFootprintColumns:1,groundFootprintRows:1,anchorX:.0058,anchorY:.1587,displayHeight:158.5};
 const currentRenderOptions={...FIELD_RENDER_METRICS,tileWidth:80,tileHeight:40,billboardScale:.5};
 for(const currentObjectOrder of [[currentLongObject,currentFrontObject],[currentFrontObject,currentLongObject]]){
  const currentMapSurface={...currentFlatSurface,objects:currentObjectOrder};
  assert.ok(resolveFieldSceneryDepth(currentFrontObject,currentMapSurface,currentRenderOptions)>resolveFieldSceneryDepth(currentLongObject,currentMapSurface,currentRenderOptions));
 }
});

function measureShadowPolygonBounds(currentPolygonPoints){
 const currentHorizontalValues=currentPolygonPoints.map(currentPointValue=>currentPointValue.x);
 const currentVerticalValues=currentPolygonPoints.map(currentPointValue=>currentPointValue.y);
 const currentMinimumHorizontal=Math.min(...currentHorizontalValues),currentMaximumHorizontal=Math.max(...currentHorizontalValues);
 const currentMinimumVertical=Math.min(...currentVerticalValues),currentMaximumVertical=Math.max(...currentVerticalValues);
 return [(currentMinimumHorizontal+currentMaximumHorizontal)/2,(currentMinimumVertical+currentMaximumVertical)/2,currentMaximumHorizontal-currentMinimumHorizontal,currentMaximumVertical-currentMinimumVertical];
}

test('그림자 크기는 점유 수와 무관하게 타일 열·행 길이이다',()=>{
 for(const currentFootprintSize of [[1,1],[2,2],[3,1]]){
  const currentPolygonPoints=buildBillboardShadowPolygon(...currentFootprintSize,{x:0,y:0},{tileWidth:160,tileHeight:80,shadowScaleX:2,shadowScaleY:.5});
  const currentColumnValues=currentPolygonPoints.map(currentPointValue=>currentPointValue.x/160+currentPointValue.y/80);
  const currentRowValues=currentPolygonPoints.map(currentPointValue=>currentPointValue.y/80-currentPointValue.x/160);
  assert.ok(Math.abs(Math.max(...currentColumnValues)-Math.min(...currentColumnValues)-2)<1e-10);
  assert.ok(Math.abs(Math.max(...currentRowValues)-Math.min(...currentRowValues)-.5)<1e-10);
 }
});

test('빌보드 높이가 바뀌어도 타일 단위 그림자 크기는 유지된다',()=>{
 const currentPolygonRecords=[];
 const currentMockScene={add:{graphics:()=>({setDepth(){return this;},fillStyle(){},fillPoints(currentPolygonPoints){currentPolygonRecords.push(currentPolygonPoints);}})}};
 for(const currentDisplayHeight of [40,400])drawBillboardContactShadow(currentMockScene,{displayHeight:currentDisplayHeight,groundFootprintColumns:2,groundFootprintRows:1,shadowScaleX:2,shadowScaleY:1,billboardAnchorMode:'tile-intersection',anchorX:0,anchorY:0},{x:0,y:0},100,{tileWidth:160,tileHeight:80});
 assert.deepEqual(currentPolygonRecords.slice(0,3),currentPolygonRecords.slice(3));
});
