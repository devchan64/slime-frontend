import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const currentModuleBuild = await build({entryPoints:['src/ui/TravelerPermitList.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{
  name:'permit-translations',setup(currentBuildContext) {
    currentBuildContext.onResolve({filter:/^\.\.\/i18n$/},()=>({path:'translations',namespace:'permit-test'}));
    currentBuildContext.onLoad({filter:/.*/,namespace:'permit-test'},()=>({loader:'js',contents:"export const useTranslation=()=>({t:key=>key,locale:'ko'});"}));
  }
}]});
const {TravelerPermitList} = await import(`data:text/javascript;base64,${Buffer.from(currentModuleBuild.outputFiles[0].text).toString('base64')}`);
function collectPermitTreeNodes(currentTreeNode) {
  if (!currentTreeNode || typeof currentTreeNode !== 'object') return [currentTreeNode];
  return [currentTreeNode,...[currentTreeNode.props?.children].flat(Infinity).flatMap(collectPermitTreeNodes)];
}
test('정보 미제공과 증서 없음은 서로 다른 안내를 표시한다',()=>{
  for (const [currentPermitSummary,currentExpectedMessage] of [[undefined,'citizenship.permitUnavailable'],[{records:[]},'citizenship.permitEmpty']]) {
    const currentTreeNodes = collectPermitTreeNodes(TravelerPermitList({currentPermitSummary,currentCharacterName:'검수자'}));
    assert.ok(currentTreeNodes.includes(currentExpectedMessage));
  }
});
test('같은 도시의 개별 증서를 합치지 않고 유효·만료와 기간을 표시하며 사용 버튼을 만들지 않는다',()=>{
  const currentPermitSummary = {records:['VALID','EXPIRED'].map((currentPermitStatus,currentRecordIndex)=>({
    instanceId:`permit-${currentRecordIndex}`,itemId:'city-traveler-permit',characterId:'owner',cityId:'iseulon',cityName:'이슬온',
    issuerId:'guard',issuedAt:100,expiresAt:604900,status:currentPermitStatus,quantity:1,weightG:null,nameTranslations:{ko:'여행자증명서',en:'Traveler Certificate'}
  }))};
  const currentTreeNodes = collectPermitTreeNodes(TravelerPermitList({currentPermitSummary,currentCharacterName:'검수자'}));
  assert.equal(currentTreeNodes.filter(currentTreeNode=>currentTreeNode?.type==='li').length,2);
  for (const currentExpectedMessage of ['citizenship.valid','citizenship.expired','citizenship.permitIssued','citizenship.expires','검수자']) assert.ok(currentTreeNodes.includes(currentExpectedMessage));
  assert.equal(currentTreeNodes.filter(currentTreeNode=>currentTreeNode?.type==='button').length,0);
});
