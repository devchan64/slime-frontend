import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles }=await build({entryPoints:['src/client/mapText.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { localizedFieldMap,localizedMapName }=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('표시용 맵과 목적지를 전환하고 서버 좌표·연결·원문을 유지한다',()=>{
 const map={id:'meadow',name:'이슬 초원',nameTranslations:{ko:'이슬 초원',en:'Dew Meadow'},connections:[{id:'gate',column:0,row:2,target:'grove',targetName:'푸른 숲',targetNameTranslations:{ko:'푸른 숲',en:'Verdant Forest'}}]};
 const result=localizedFieldMap(map,'en');
 assert.equal(result.name,'Dew Meadow');
 assert.equal(result.connections[0].targetName,'Verdant Forest');
 assert.equal(result.connections[0].id,'gate');
 assert.equal(result.connections[0].column,0);
 assert.equal(map.connections[0].targetName,'푸른 숲');
 assert.deepEqual(localizedFieldMap(result,'ko'),map);
 assert.equal(localizedMapName('원문',undefined,'en'),'원문');
});
test('잘못된 새 번역은 원문으로 숨기지 않는다',()=>{
 for(const translations of [null,{}, {en:'Name'}, {ko:'이름',en:''}, {ko:'이름',en:'Name',ja:'名前'}])
  assert.throws(()=>localizedMapName('이름',translations,'en'));
});
