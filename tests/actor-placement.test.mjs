import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledPlacementBundle = await build({stdin:{contents:`export * from './src/game/terrain/actorPlacement'; export * from './src/game/terrain/elevation'; export * from './src/game/terrain/rotation';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const placementTestModule = await import(`data:text/javascript;base64,${Buffer.from(compiledPlacementBundle.outputFiles[0].text).toString('base64')}`);
const {calculateActorPlacement, project, cellDepth, toView} = placementTestModule;
const currentTestSurface = {columns:8,rows:8};
test('2×2 영역은 네 셀 중앙에 표시하며 모든 회전에서 앞쪽 셀보다 위에 그린다',()=>{
  for(const currentViewRotation of [0,1,2,3]) {
    const projectTestPosition = currentCellPosition => project(toView(currentCellPosition,currentTestSurface,currentViewRotation),currentTestSurface);
    const calculateTestDepth = currentCellPosition => cellDepth(toView(currentCellPosition,currentTestSurface,currentViewRotation));
    const actualActorPlacement = calculateActorPlacement({column:3,row:2},2,currentTestSurface,projectTestPosition,calculateTestDepth);
    assert.deepEqual(actualActorPlacement.cells,[{column:3,row:2},{column:4,row:2},{column:3,row:3},{column:4,row:3}]);
    const projectedCellCenters = actualActorPlacement.cells.map(projectTestPosition);
    assert.equal(actualActorPlacement.x,projectedCellCenters.reduce((sumValue,cellValue)=>sumValue+cellValue.x,0)/4);
    assert.equal(actualActorPlacement.y,projectedCellCenters.reduce((sumValue,cellValue)=>sumValue+cellValue.y,0)/4);
    for(const currentFootprintCell of actualActorPlacement.cells) assert.ok(actualActorPlacement.depth>=calculateTestDepth(currentFootprintCell));
  }
});
test('지도 끝의 2×2 영역은 지도 안에 두며 1×1 위치는 유지한다',()=>{
 const calculateTestProjection = currentCellPosition => project(currentCellPosition,currentTestSurface);
 const largeActorPlacement = calculateActorPlacement({column:7,row:7},2,currentTestSurface,calculateTestProjection,cellDepth);
 assert.deepEqual(largeActorPlacement.cells,[{column:6,row:6},{column:7,row:6},{column:6,row:7},{column:7,row:7}]);
 const smallActorPlacement = calculateActorPlacement({column:3,row:2},1,currentTestSurface,calculateTestProjection,cellDepth);
 assert.equal(smallActorPlacement.x,calculateTestProjection({column:3,row:2}).x);
 assert.equal(smallActorPlacement.y,calculateTestProjection({column:3,row:2}).y);
});

test('엇갈린 높이의 네 타일을 모두 표시 중심 계산에 반영한다',()=>{
 const currentRaisedSurface={columns:2,rows:2,elevations:[[0,2],[2,0]]};
 const projectRaisedPosition=currentCellPosition=>project(currentCellPosition,currentRaisedSurface);
 const actualActorPlacement=calculateActorPlacement({column:0,row:0},2,currentRaisedSurface,projectRaisedPosition,cellDepth);
 const projectedCellCenters=[{column:0,row:0},{column:1,row:0},{column:0,row:1},{column:1,row:1}].map(projectRaisedPosition);
 assert.equal(actualActorPlacement.y,projectedCellCenters.reduce((totalProjectedValue,currentProjectedCell)=>totalProjectedValue+currentProjectedCell.y,0)/4);
 assert.equal(actualActorPlacement.y,69);
});
