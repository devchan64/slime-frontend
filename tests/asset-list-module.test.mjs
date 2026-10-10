import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAssetListModule} from '../scripts/asset-list-module.mjs';
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
