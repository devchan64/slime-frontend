import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentBuildResult=await build({entryPoints:['src/client/costumeInventory.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseCostumeInventory}=await import(`data:text/javascript;base64,${Buffer.from(currentBuildResult.outputFiles[0].text).toString('base64')}`);
const currentInventoryFixture={characterVersion:3,defaultCostumeId:'default',entries:[{costumeId:'default',valueP:25,version:1,designId:'default',designVersion:1,source:'shop',acquiredAt:100,nameTranslations:{ko:'기본',en:'Default'},descriptionTranslations:{ko:'획득 당시 설명',en:'Acquired description'}}]};
for(const currentSourceKind of ['shop','parcel'])test(`${currentSourceKind} 획득 기록과 당시 정의를 보존한다`,()=>{
 const currentInventoryData=structuredClone(currentInventoryFixture);currentInventoryData.entries[0].source=currentSourceKind;
 assert.deepEqual(parseCostumeInventory(currentInventoryData),currentInventoryData);
});
test('미등록 획득 경로와 내부 거래 ID 노출을 거절한다',()=>{
 for(const currentInvalidPatch of [{source:'drop'},{source:''},{source:null},{purchaseId:'private-id'},{parcelId:'private-id'}]){
  const currentInventoryData=structuredClone(currentInventoryFixture);Object.assign(currentInventoryData.entries[0],currentInvalidPatch);
  assert.throws(()=>parseCostumeInventory(currentInventoryData));
 }
});
