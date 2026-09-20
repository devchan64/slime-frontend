import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiledCityModule = await build({stdin:{contents:"export * from './src/game/terrain/cityBuildings'; export * from './src/ui/fieldNavigation';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {findCityBuilding,cityBuildingCells,fieldRoute} = await import(`data:text/javascript;base64,${Buffer.from(compiledCityModule.outputFiles[0].text).toString('base64')}`);
const currentTestBuilding = {id:'test-guild',facilityId:'test-guild',facilityKind:'guild',name:'길드',origin:{column:2,row:2},width:4,height:3,entrance:{column:4,row:5},facing:'south'};
test('전체 점유 셀과 출입구는 같은 시설을 선택하고 외부 타일은 선택하지 않는다',()=>{
 const currentBuildingCells=cityBuildingCells(currentTestBuilding);
 assert.equal(currentBuildingCells.length,12);
 assert.equal(new Set(currentBuildingCells.map(currentCellPosition=>`${currentCellPosition.column},${currentCellPosition.row}`)).size,12);
 for(const currentCellPosition of [...currentBuildingCells,currentTestBuilding.entrance]) assert.equal(findCityBuilding([currentTestBuilding],currentCellPosition),currentTestBuilding);
 assert.equal(findCityBuilding([currentTestBuilding],{column:6,row:4}),undefined);
 assert.equal(findCityBuilding(undefined,currentTestBuilding.origin),undefined);
 assert.equal(findCityBuilding([currentTestBuilding],null),undefined);
});
test('건물 내부 경로는 거부하고 출입구로 우회하며 도착 후 추가 이동하지 않는다',()=>{
 const currentCitySurface={columns:9,rows:9,blocked:cityBuildingCells(currentTestBuilding)};
 const currentPlayerPosition={column:4,row:0};
 assert.equal(fieldRoute(currentPlayerPosition,currentTestBuilding.origin,currentCitySurface),null);
 const currentEntranceRoute=fieldRoute(currentPlayerPosition,currentTestBuilding.entrance,currentCitySurface);
 assert.ok(currentEntranceRoute.length>0);
 assert.deepEqual(currentEntranceRoute.at(-1),currentTestBuilding.entrance);
 for(const currentRoutePosition of currentEntranceRoute) assert.ok(!currentCitySurface.blocked.some(currentBlockedPosition=>currentBlockedPosition.column===currentRoutePosition.column&&currentBlockedPosition.row===currentRoutePosition.row));
 assert.deepEqual(fieldRoute(currentTestBuilding.entrance,currentTestBuilding.entrance,currentCitySurface),[]);
});
