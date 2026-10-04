import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildFieldCellGeometry,buildFieldPanelVertices,buildFieldBoundaryPanels,resolveFieldAuraUvs,FIELD_RENDER_METRICS,FIELD_SAFE_AURA_PROFILE,rotateSurfacePosition,projectSurfaceCell} from '../packages/field-renderer/field-renderer.mjs';

const currentNodeRequire=createRequire(import.meta.url);
const PhaserMeshVertex=currentNodeRequire('phaser/src/geom/mesh/Vertex.js');
const PhaserMatrixFour=currentNodeRequire('phaser/src/math/Matrix4.js');
const currentFlatSurface={columns:9,rows:9,elevations:Array.from({length:9},()=>Array(9).fill(0))};

test('결계 패널은 Phaser 실제 직교 투영 후에도 엣지 전체 너비와 위쪽 25px을 유지한다',()=>{
 const currentBoundaryPanels=buildFieldBoundaryPanels({column:4,row:4},{column:4,row:4},0,{x:500,y:400});
 for(const currentPanelPoints of currentBoundaryPanels){
  assert.equal(currentPanelPoints[3].y-currentPanelPoints[0].y,25);
  assert.equal(currentPanelPoints[2].y-currentPanelPoints[1].y,25);
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
 }
 assert.throws(()=>resolveFieldAuraUvs(8,1774,887));
 const currentStairSurface={columns:2,rows:2,elevations:[[0,0],[1,1]],elevationTiles:[{cell:{column:1,row:1},lower:{column:1,row:0}}]};
 for(let currentRotationValue=0;currentRotationValue<4;currentRotationValue++){
  const currentFaceRecords=buildFieldCellGeometry({column:1,row:1},currentStairSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationValue});
  assert.equal(currentFaceRecords.filter(currentFaceRecord=>currentFaceRecord.kind==='tread').length,6);
  assert.ok(currentFaceRecords.flatMap(currentFaceRecord=>currentFaceRecord.points).every(currentPointValue=>Number.isFinite(currentPointValue.x)&&Number.isFinite(currentPointValue.y)));
 }
});
