import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundledReportResult = await build({entryPoints:['src/ui/PartyRewardReport.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'report-translations',setup(bundleBuildContext){
  bundleBuildContext.onResolve({filter:/^\.\.\/i18n$/},()=>({path:'translations',namespace:'report-test'}));
  bundleBuildContext.onLoad({filter:/.*/,namespace:'report-test'},()=>({contents:`export const useTranslation=()=>({locale:'ko',t:(key,values)=>key+JSON.stringify(values??{})});`,loader:'js'}));
}}]});
const { PartyRewardReport } = await import(`data:text/javascript;base64,${Buffer.from(bundledReportResult.outputFiles[0].text).toString('base64')}`);
function collectReportText(reportNodeValue) {
  if (reportNodeValue == null || typeof reportNodeValue === 'boolean') return '';
  if (Array.isArray(reportNodeValue)) return reportNodeValue.map(collectReportText).join(' ');
  if (typeof reportNodeValue === 'object') return collectReportText(reportNodeValue.props.children);
  return String(reportNodeValue);
}
test('내 몫이 0이어도 전체 획득과 지원자 보관함·눈금을 표시한다',()=>{
  const reportTextValue=collectReportText(PartyRewardReport({rewardReportData:{materials:[{
    materialId:'jelly',nameTranslations:{ko:'단백질젤리',en:'Protein jelly'},quantity:2,mineQuantity:0,
    recipients:[{id:'participant-2',name:'지원자 이름',role:'supporter',isMine:false,quantity:2}],
    allocations:[{itemSequence:1,diceFace:1,recipientId:'participant-2'},{itemSequence:2,diceFace:1,recipientId:'participant-2'}],
  }]}}));
  assert.match(reportTextValue, /"total":2,"mine":0/);
  assert.match(reportTextValue, /지원자 이름/);
  assert.match(reportTextValue, /distributionMailbox/);
  assert.match(reportTextValue, /"sequence":2,"face":1/);
  assert.doesNotMatch(reportTextValue, /noLoot/);
});
test('빈 분배에는 획득 없음만 안내한다',()=>{
  const reportTextValue=collectReportText(PartyRewardReport({rewardReportData:{materials:[]}}));
  assert.match(reportTextValue,/noLoot/);
  assert.doesNotMatch(reportTextValue,/distributionMailbox|distributionQuantities/);
});

test('길드 귀속 보상에는 개인 보관함 수령 안내를 표시하지 않는다',()=>{
 const currentReportText=collectReportText(PartyRewardReport({rewardReportData:{materials:[{
  materialId:'protein-jelly',nameTranslations:{ko:'젤리',en:'Jelly'},quantity:1,mineQuantity:0,
  recipients:[{id:'p2',name:'초보 길드원',role:'supporter',recipientKind:'guild',isMine:false,quantity:1}],
  allocations:[{itemSequence:1,diceFace:1,recipientId:'p2'}]
 }]}}));
 assert.match(currentReportText,/distributionGuildStorage/);
 assert.doesNotMatch(currentReportText,/distributionMailbox/);
});
