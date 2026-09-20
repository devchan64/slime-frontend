import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles:compiledWorldOutputs}=await build({entryPoints:['src/client/worldMap.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {parseWorldMapCatalog}=await import(`data:text/javascript;base64,${Buffer.from(compiledWorldOutputs[0].text).toString('base64')}`);
function createWorldMapFixture(){return {version:1,maps:[{id:'field',name:'필드',nameTranslations:{ko:'필드',en:'Field'},safeTown:false,column:0,row:0,connections:[{target:'town',direction:'north'}]},{id:'town',name:'마을',nameTranslations:{ko:'마을',en:'Town'},safeTown:true,column:0,row:-1,connections:[{target:'field',direction:'south'}]}]};}
test('전체 맵 배치와 마을 유형을 보존한다',()=>{const currentWorldFixture=createWorldMapFixture();assert.deepEqual(parseWorldMapCatalog(currentWorldFixture),currentWorldFixture.maps);});
test('누락 대상, 중복 위치, 충돌 방향, 알 수 없는 필드를 거부한다',()=>{
  for(const mutateWorldFixture of [currentWorldFixture=>currentWorldFixture.maps.pop(),currentWorldFixture=>currentWorldFixture.maps[1].row=0,currentWorldFixture=>currentWorldFixture.maps[0].connections[0].direction='west',currentWorldFixture=>currentWorldFixture.extra=true]){const currentWorldFixture=createWorldMapFixture();mutateWorldFixture(currentWorldFixture);assert.throws(()=>parseWorldMapCatalog(currentWorldFixture));}
});
