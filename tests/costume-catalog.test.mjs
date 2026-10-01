import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/client/costumeCatalog.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseCostumeCatalog}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
const currentCatalogFixture={version:1,defaultCostumeId:'default',entries:[{costumeId:'default',version:1,designId:'default',designVersion:1,nameTranslations:{ko:'기본',en:'Default'},descriptionTranslations:{ko:'설명',en:'Details'}}]};
test('전체 디자인 카탈로그와 번역을 보존한다',()=>assert.deepEqual(parseCostumeCatalog(currentCatalogFixture),currentCatalogFixture));
test('중복·부품·수치·번역·기본 참조 오류는 거절한다',()=>{
 for(const mutateCatalogFixture of [currentCatalogData=>{currentCatalogData.entries.push(currentCatalogData.entries[0]);},currentCatalogData=>{currentCatalogData.entries[0].face='part';},currentCatalogData=>{currentCatalogData.entries[0].designVersion=true;},currentCatalogData=>{delete currentCatalogData.entries[0].nameTranslations.en;},currentCatalogData=>{currentCatalogData.defaultCostumeId='missing';},currentCatalogData=>{currentCatalogData.entries[0].descriptionTranslations.ko=' ';}]){
  const currentInvalidData=structuredClone(currentCatalogFixture);mutateCatalogFixture(currentInvalidData);assert.throws(()=>parseCostumeCatalog(currentInvalidData));
 }
});
