import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAssetListModule,buildMaterialFrameModule} from '../scripts/asset-list-module.mjs';
test('타일 목록을 정적 import로 변환하고 중복 경로 별칭을 유지한다',()=>{
 const currentModuleText=buildAssetListModule('firstTileSource: assets/tiles/terrain/non-road/a.png\nsecondTileSource: assets/tiles/terrain/non-road/a.png','/asset-root');
 assert.equal((currentModuleText.match(/import registeredTileAsset/g)||[]).length,2);
 assert.match(currentModuleText,/"firstTileSource": registeredTileAsset0/);
 assert.match(currentModuleText,/"secondTileSource": registeredTileAsset1/);
});
test('중복 키·경로 이탈·자료형 오류·빈 목록을 거절한다',()=>{
 for(const currentInvalidYaml of ['tile: assets/tiles/a.png\ntile: assets/tiles/b.png','tile: ../secret.png','tile: 12','- assets/tiles/a.png','{}'])assert.throws(()=>buildAssetListModule(currentInvalidYaml,'/asset-root'));
});
test('현재 지형 목록의 전체 경로가 로더 계약을 충족한다',()=>{
 const currentYamlText=readFileSync(new URL('../src/game/terrain/terrain.asset-list.yaml',import.meta.url),'utf8');
 assert.match(buildAssetListModule(currentYamlText,'/asset-root'),/farm-embankment-v1.png/);
});

test('공통 재질 매핑은 중복 코드·프레임과 잘못된 YAML을 거절한다',async()=>{
 for(const currentInvalidYaml of ['grass: grass\ngrass: flowers','grass: same\nflowers: same','grass: 12','[]','{}'])assert.throws(()=>buildMaterialFrameModule(currentInvalidYaml));
 const currentModuleText=buildMaterialFrameModule('grass: grass\nflowers: flowers');
 const currentLoadedModule=await import('data:text/javascript;base64,'+Buffer.from(currentModuleText).toString('base64'));
 assert.deepEqual(currentLoadedModule.default,{grass:'grass',flowers:'flowers'});
});
