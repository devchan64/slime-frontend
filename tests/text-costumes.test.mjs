import test from 'node:test';
import assert from 'node:assert/strict';
import {TextClient} from '../scripts/text-client-core.mjs';
const currentCatalogFixture={version:1,defaultCostumeId:'default',entries:[{costumeId:'default',version:1,designId:'default',designVersion:1,nameTranslations:{ko:'기본 의상',en:'Default'},descriptionTranslations:{ko:'전체 디자인\n설명',en:'Details'}}]};
test('코스튬 조회는 명령 복구 대기 중에도 읽기만 수행하고 상태를 보존한다',async()=>{
 const currentRequestCalls=[];
 const currentTextClient=new TextClient('http://localhost:18080',{fetcher:async(currentRequestUrl,currentRequestOptions)=>{currentRequestCalls.push({url:currentRequestUrl,options:currentRequestOptions});return new Response(JSON.stringify(currentCatalogFixture));}});
 currentTextClient.state={me:{id:'hero',version:3}};currentTextClient.pendingCommandRequest={path:'pending'};
 const currentOriginalState=structuredClone(currentTextClient.state);
 const currentCatalogText=await currentTextClient.execute('costumes');
 assert.match(currentCatalogText,/기본 의상 \[default\]/);assert.match(currentCatalogText,/디자인 default v1/);assert.match(currentCatalogText,/전체 디자인 설명/);
 assert.deepEqual(currentTextClient.state,currentOriginalState);assert.deepEqual(currentTextClient.pendingCommandRequest,{path:'pending'});
 assert.equal(currentRequestCalls.length,1);assert.ok(currentRequestCalls[0].url.endsWith('/v1/costumes'));assert.equal(currentRequestCalls[0].options.method,'GET');assert.equal(currentRequestCalls[0].options.body,undefined);
 await assert.rejects(currentTextClient.execute('costumes equip default'),/조회하세요/);assert.equal(currentRequestCalls.length,1);
});
