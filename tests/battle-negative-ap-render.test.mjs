import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
const bundledPanelOutput = await build({entryPoints:['src/ui/BattlePanel.tsx'],bundle:true,resolveExtensions:['.ts','.tsx','.js','.mjs'],write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'battle-render-hooks',setup(bundleBuildContext){
 bundleBuildContext.onResolve({filter:/^\.\/(BattleActionPoints|battleActionPoints)$/},importPathRecord=>({path:resolve('src/ui',importPathRecord.path.endsWith('/BattleActionPoints')?'BattleActionPoints.tsx':'battleActionPoints.ts')}));
 bundleBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},importPathRecord=>({path:importPathRecord.path,namespace:'render-test'}));
 bundleBuildContext.onLoad({filter:/.*/,namespace:'render-test'},importPathRecord=>({contents:importPathRecord.path==='preact/hooks'?
  'export const useState=(value)=>[typeof value==="function"?value():value,()=>{}];export const useRef=(value)=>({current:value});export const useEffect=()=>{};':
  'export const useTranslation=()=>({locale:"ko",t:(key,values)=>key==="battle.apRecovery"?key+":"+values.count:key});',loader:'js'}));
}}]});
const { BattlePanel } = await import(`data:text/javascript;base64,${Buffer.from(bundledPanelOutput.outputFiles[0].text).toString('base64')}`);
function collectRenderedNodes(currentRenderNode) {
 if (currentRenderNode == null || typeof currentRenderNode === 'boolean') return [];
 if (Array.isArray(currentRenderNode)) return currentRenderNode.flatMap(collectRenderedNodes);
 if (typeof currentRenderNode !== 'object') return [currentRenderNode];
 if (typeof currentRenderNode.type === 'function') return collectRenderedNodes(currentRenderNode.type(currentRenderNode.props));
 return [currentRenderNode,...collectRenderedNodes(currentRenderNode.props.children)];
}
for(const currentMaximumPoints of [0,5])for(const currentPolicyVersion of [undefined,1,2])test('최대 AP '+currentMaximumPoints+' · 회복 정책 '+currentPolicyVersion+'의 소진 AP·회복 안내·턴 종료 렌더링',()=>{
 const battleStateRecord={id:'battle',apRecoveryPolicyVersion:currentPolicyVersion,rulesVersion:'1.4.0',status:'ACTIVE',round:2,turnId:3,version:4,index:0,order:['me'],log:[],
  field:{columns:5,rows:5,cells:[],blocked:[]},tactics:{canAct:true,moves:[],attacks:[]},
  units:[{id:'me',name:'모험가',side:'ally',hp:25,maxHp:25,ap:currentMaximumPoints===0?0:-1,maxAp:currentMaximumPoints,position:{column:1,row:1}}]};
 const renderedPanelNodes=collectRenderedNodes(BattlePanel({me:{skills:{},battleSkillLoadout:[]},battle:battleStateRecord,actor:'me',selected:null,disabled:false,select:()=>{},execute:()=>{}}));
 assert.ok(renderedPanelNodes.includes('battle.apExhausted'));
 assert.ok(renderedPanelNodes.includes(currentMaximumPoints===0?0:-1));
 assert.ok(renderedPanelNodes.includes(currentPolicyVersion===2?'battle.apRulesFloor':'battle.apRules'));
 assert.ok(renderedPanelNodes.includes('battle.apRecovery:'+(currentMaximumPoints===0?0:currentPolicyVersion===2?2:3)));
 const endTurnButtonNode=renderedPanelNodes.find(renderedPanelNode=>renderedPanelNode?.type==='button'&&renderedPanelNode.props.children==='battle.endTurn');
 assert.equal(endTurnButtonNode.props.disabled,false);
});

for (const currentAutomaticEnabled of [false, true]) for (const currentOwnTurn of [false, true]) test(`자동전투 ${currentAutomaticEnabled} · 본인 턴 ${currentOwnTurn}의 전환과 수동 버튼`, () => {
 const currentBattleState = {id:'battle',rulesVersion:'1.4.0',status:'ACTIVE',round:1,turnId:1,version:1,index:currentOwnTurn?0:1,order:['me','enemy'],log:[],
  field:{columns:5,rows:5,cells:[],blocked:[]},tactics:{canAct:currentOwnTurn,moves:[],attacks:[]},
  units:[{id:'me',name:'모험가',side:'ally',hp:25,maxHp:25,ap:5,maxAp:5,automaticPlay:currentAutomaticEnabled,position:{column:1,row:1}},
    {id:'enemy',name:'슬라임',side:'enemy',hp:5,maxHp:5,position:{column:3,row:3}}]};
 const currentSubmittedCommands = [];
 const currentRenderedNodes = collectRenderedNodes(BattlePanel({me:{skills:{},battleSkillLoadout:[]},battle:currentBattleState,actor:'me',selected:null,disabled:false,select:()=>{},execute:(...currentCommandArguments)=>currentSubmittedCommands.push(currentCommandArguments)}));
 const currentToggleButton = currentRenderedNodes.find(currentRenderNode => currentRenderNode?.type === 'button' && currentRenderNode.props.children === (currentAutomaticEnabled?'battle.automaticDisable':'battle.automaticEnable'));
 assert.equal(currentToggleButton.props.disabled, false);
 assert.equal(currentToggleButton.props['aria-pressed'], currentAutomaticEnabled);
 currentToggleButton.props.onClick();
 assert.deepEqual(currentSubmittedCommands, [['AUTO_PLAY',undefined,undefined,!currentAutomaticEnabled]]);
 for (const currentButtonLabel of ['battle.endTurn','battle.skills']) {
  const currentManualButton = currentRenderedNodes.find(currentRenderNode => currentRenderNode?.type === 'button' && currentRenderNode.props.children === currentButtonLabel);
  assert.equal(currentManualButton.props.disabled, currentAutomaticEnabled || !currentOwnTurn);
 }
 assert.ok(currentRenderedNodes.includes(currentAutomaticEnabled?'battle.automaticActiveHelp':'battle.automaticManualHelp'));
});
