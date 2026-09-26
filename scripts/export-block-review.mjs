/** 서버에서 명시적으로 내보낸 스냅샷을 공용 기하로 변환한다. */
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [sourceSnapshotPath,outputSnapshotPath]=process.argv.slice(2);
if(!sourceSnapshotPath||!outputSnapshotPath)throw new Error('입력 스냅샷과 출력 경로가 필요합니다.');
const sourceSnapshotBytes=readFileSync(sourceSnapshotPath);
const sourceSnapshotRecord=JSON.parse(sourceSnapshotBytes);
const compiledGeometryModule=await build({entryPoints:['src/game/terrain/blockGeometry.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {buildBlockSurfaceFaces}=await import(`data:text/javascript;base64,${Buffer.from(compiledGeometryModule.outputFiles[0].text).toString('base64')}`);
const exportedBuildingRecords=sourceSnapshotRecord.buildings.map(currentBuildingRecord=>({...currentBuildingRecord,faces:buildBlockSurfaceFaces(currentBuildingRecord.blocks)}));
writeFileSync(outputSnapshotPath,JSON.stringify({...sourceSnapshotRecord,buildings:exportedBuildingRecords,reviewProvenance:{sourceSha256:createHash('sha256').update(sourceSnapshotBytes).digest('hex'),geometrySha256:createHash('sha256').update(readFileSync('src/game/terrain/blockGeometry.ts')).digest('hex'),temporaryMaterials:true}},null,2));
console.log('블록 기하 검수 사본 저장:',outputSnapshotPath);
