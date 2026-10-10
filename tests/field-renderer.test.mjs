import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAssetListModule} from '../scripts/asset-list-module.mjs';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolveFieldSceneryPlacement,drawFieldSceneryObject,buildFieldMaterialEdges,drawFieldAuraPanel,buildFieldRoadEdges,drawFieldElevationOutline,buildFieldElevationEdges,buildFieldCellGeometry,buildFieldPanelVertices,buildFieldBoundaryPanels,drawFieldActorContactShadow,resolveFieldAuraUvs,FIELD_RENDER_METRICS,FIELD_SAFE_AURA_PROFILE,FIELD_ACTOR_CONTACT_SHADOW_PROFILES,rotateSurfacePosition,projectSurfaceCell} from '../packages/field-renderer/field-renderer.mjs';

const currentNodeRequire=createRequire(import.meta.url);
const PhaserMeshVertex=currentNodeRequire('phaser/src/geom/mesh/Vertex.js');
const PhaserMatrixFour=currentNodeRequire('phaser/src/math/Matrix4.js');
const currentFlatSurface={columns:9,rows:9,elevations:Array.from({length:9},()=>Array(9).fill(0))};

test('접지 그림자 기본값은 중형 사람의 0.4×0.32 타일 비율을 유지한다',()=>{
 const currentBaselineProfile=FIELD_ACTOR_CONTACT_SHADOW_PROFILES.baseline;
 assert.deepEqual(currentBaselineProfile,{width:0.4,height:0.32,alpha:0.3,coreAlpha:0.24,coreScale:0.65,scale:1.3,opacityScale:1.5});
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
  assert.equal(currentFaceRecords.filter(currentFaceRecord=>currentFaceRecord.kind==='tread').length,3);
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
 assert.deepEqual(buildFieldElevationEdges({column:1,row:1},currentStairSurface),[]);
 assert.equal(buildFieldElevationEdges({column:2,row:1},currentStairSurface).length,3);
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
 assert.equal(buildFieldCliffEdges(currentMiddleCell,currentStairSurface,currentMiddleFace.points).length,3);
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

test('필드 공용 재질 선택은 맵별 도로와 바탕 재질 계약을 유지한다',async()=>{
 const {build}=await import('esbuild');
 const {outputFiles}=await build({entryPoints:['src/game/terrain/fieldTileRendering.ts'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty','.webp':'empty'},plugins:[{name:'texture-test',setup(currentBuildContext){
 currentBuildContext.onLoad({filter:/\.asset-list\.yaml$/},async currentModuleArguments=>({contents:buildAssetListModule(await readFile(currentModuleArguments.path,'utf8'),resolve('../slime-assets')),loader:'js'}));
 currentBuildContext.onResolve({filter:/field-renderer\.mjs$/},()=>({path:'connected',namespace:'test-mock'}));
 currentBuildContext.onLoad({filter:/.*/,namespace:'test-mock'},()=>({contents:"export const prepareFieldConnectedTexture=(scene,source,grass,mask)=>source+'-'+mask;"}));
 }}]});
 const {resolveFieldTileTextures}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
 const currentMaterialReader=()=> 'grass';
 const currentMeadowTile=resolveFieldTileTextures({},'road',{column:0,row:0},'meadow',5,currentMaterialReader);
 assert.equal(currentMeadowTile.ground,'terrain-source-dirt-road');
 assert.equal(resolveFieldTileTextures({},'road',{column:0,row:0},'broken-quarry',5,currentMaterialReader).ground,'terrain-source-stone-road');
 assert.equal(resolveFieldTileTextures({},'road',{column:0,row:0},'ash-edge',5,currentMaterialReader).ground,'terrain-source-dirt-road');
 assert.equal(resolveFieldTileTextures({},'road',{column:1,row:0},'ash-edge',5,currentMaterialReader).ground,'terrain-source-dirt-road');
 assert.equal(resolveFieldTileTextures({},'flowers',{column:1,row:0},'meadow',0,currentMaterialReader).ground,'terrain-source-meadow-flowers');
 assert.equal(resolveFieldTileTextures({},'boulder',{column:1,row:0},'ash-edge',0,currentMaterialReader).underlay,'terrain-source-grass');
});


test('지형지물은 타일 중심 접지와 깊이를 공유하고 결계타워도 같은 진입점을 사용한다',()=>{
 const currentRecordedImages=[];
 const currentMockScene={textures:{exists:currentTextureKey=>['tree-sprite','tower-sprite'].includes(currentTextureKey)},add:{image(currentPositionX,currentPositionY,currentTextureKey){
  const currentImageRecord={x:currentPositionX,y:currentPositionY,key:currentTextureKey,width:200,height:300,
   setOrigin(currentAnchorX,currentAnchorY){this.origin=[currentAnchorX,currentAnchorY];return this;},
   setScale(currentScaleValue){this.scale=currentScaleValue;return this;},
   setDepth(currentDepthValue){this.depth=currentDepthValue;return this;}};
  currentRecordedImages.push(currentImageRecord);return currentImageRecord;
 }}};
 const currentObjectRecord={id:'tree-1',kind:'decoration',position:{column:2,row:3},textureKey:'tree-sprite',displayHeight:120,anchorX:.5,anchorY:.9};
 const currentRenderedTree=drawFieldSceneryObject(currentMockScene,currentObjectRecord,{x:80,y:60},31);
 assert.deepEqual([currentRenderedTree.x,currentRenderedTree.y,currentRenderedTree.scale,currentRenderedTree.depth],[80,60,.4,31]);
 assert.deepEqual(currentRenderedTree.origin,[.5,.9]);
 const currentRenderedTower=drawFieldSceneryObject(currentMockScene,{id:'tower',kind:'ward-tower',position:{column:0,row:0}},{x:10,y:20},5,'tower-sprite');
 assert.equal(currentRenderedTower.key,'tower-sprite');
 assert.equal(currentRenderedTower.depth,5);
 assert.throws(()=>drawFieldSceneryObject(currentMockScene,{...currentObjectRecord,textureKey:'missing'},{x:0,y:0},1),/텍스처 누락/);
});


test('타일 9점 앵커는 고도 중심을 유지하고 네 방향 회전과 깊이 좌표를 반영한다',()=>{
 const currentAnchorCases=[['north-west',0,-20],['north',20,-10],['north-east',40,0],['west',-20,-10],['center',0,0],['east',20,10],['south-west',-40,0],['south',-20,10],['south-east',0,20]];
 const currentObjectRecord={id:'tree',kind:'ward-tower',position:{column:4,row:6}};
 for(const [currentAnchorName,currentOffsetX,currentOffsetY] of currentAnchorCases){
  const currentPlacement=resolveFieldSceneryPlacement({...currentObjectRecord,tileAnchor:currentAnchorName},{x:100,y:-200},{tileWidth:80,tileHeight:40});
  assert.deepEqual(currentPlacement.screen,{x:100+currentOffsetX,y:-200+currentOffsetY});
 }
 const currentRotatedOffsets=[[40,0],[0,20],[-40,0],[0,-20]];
 for(let currentRotationIndex=0;currentRotationIndex<4;currentRotationIndex++){
  const currentPlacement=resolveFieldSceneryPlacement({...currentObjectRecord,tileAnchor:'north-east'},{x:100,y:-200},{tileWidth:80,tileHeight:40,rotation:currentRotationIndex});
  assert.deepEqual(currentPlacement.position,{column:4.5,row:5.5});
  assert.deepEqual(currentPlacement.screen,{x:100+currentRotatedOffsets[currentRotationIndex][0],y:-200+currentRotatedOffsets[currentRotationIndex][1]});
 }
 assert.deepEqual(resolveFieldSceneryPlacement(currentObjectRecord,{x:1,y:2}).screen,{x:1,y:2});
 assert.throws(()=>resolveFieldSceneryPlacement({...currentObjectRecord,tileAnchor:'unknown'},{x:0,y:0}),/타일 앵커/);
});
