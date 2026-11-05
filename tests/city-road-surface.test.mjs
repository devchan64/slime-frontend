import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRoadSurfaceVertexHeight,buildSurfaceCliffs,FIELD_RENDER_METRICS} from '../packages/field-surface/field-surface.mjs';
import {buildFieldCellGeometry} from '../packages/field-renderer/field-renderer.mjs';
const currentRoadSurface={id:'saltford',columns:3,rows:4,terrainRows:['ppp','ppp','ppp','ppp'],terrainCodes:{p:'paving'},elevations:[[3,3,3],[2,2,2],[1,1,1],[0,0,0]]};
test('소금여울 3칸 운송로의 단차를 균열 없는 경사면으로 연결한다',()=>{
 for(let currentColumnIndex=0;currentColumnIndex<3;currentColumnIndex++){
  const currentUpperCell={column:currentColumnIndex,row:1},currentLowerCell={column:currentColumnIndex,row:2};
  assert.equal(readRoadSurfaceVertexHeight(currentUpperCell,.5,.5,currentRoadSurface),1.5);
  assert.equal(readRoadSurfaceVertexHeight(currentLowerCell,.5,-.5,currentRoadSurface),1.5);
 }
 assert.equal(buildSurfaceCliffs({column:1,row:1},currentRoadSurface,FIELD_RENDER_METRICS).length,0);
 assert.deepEqual(currentRoadSurface.elevations,[[3,3,3],[2,2,2],[1,1,1],[0,0,0]]);
});
test('다른 도시와 비도로는 평탄 타일과 절벽을 유지한다',()=>{
 assert.equal(readRoadSurfaceVertexHeight({column:1,row:1},.5,.5,{...currentRoadSurface,id:'iseulon'}),2);
 assert.equal(readRoadSurfaceVertexHeight({column:1,row:1},.5,.5,{...currentRoadSurface,terrainCodes:{p:'stone'}}),2);
 assert.equal(buildSurfaceCliffs({column:1,row:1},{...currentRoadSurface,id:'iseulon'},FIELD_RENDER_METRICS).length,1);
});
test('회전된 경사 지형도 유한한 메시와 기저 벽면을 만든다',()=>{
 for(let currentRotationIndex=0;currentRotationIndex<4;currentRotationIndex++){
  const currentCellFaces=buildFieldCellGeometry({column:1,row:1},currentRoadSurface,{...FIELD_RENDER_METRICS,rotation:currentRotationIndex});
  assert.ok(currentCellFaces.every(currentFaceRecord=>currentFaceRecord.points.every(currentPointValue=>Number.isFinite(currentPointValue.x)&&Number.isFinite(currentPointValue.y))));
 }
 assert.ok(buildSurfaceCliffs({column:2,row:3},currentRoadSurface,FIELD_RENDER_METRICS).length>0);
});
