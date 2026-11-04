import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const {outputFiles:currentCompiledFiles}=await build({entryPoints:['src/game/terrain/buildingDisplaySize.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {calculateBuildingDisplaySize}=await import('data:text/javascript;base64,'+Buffer.from(currentCompiledFiles[0].text).toString('base64'));
test('건물 크기 보정은 기존 비율을 기본값으로 유지하고 각 축을 독립적으로 변경한다',()=>{
 assert.deepEqual(calculateBuildingDisplaySize(400,512,256),{width:400,height:200});
 assert.deepEqual(calculateBuildingDisplaySize(400,512,256,10,-15),{width:410,height:185});
 assert.throws(()=>calculateBuildingDisplaySize(400,512,256,0,-200),/양수/);
 assert.throws(()=>calculateBuildingDisplaySize(400,512,256,Infinity,0),/입력/);
});
