import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
const bundledPanelOutput = await build({entryPoints:['src/ui/BattlePanel.tsx'],bundle:true,resolveExtensions:['.ts','.tsx','.js','.mjs'],write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{name:'battle-render-hooks',setup(bundleBuildContext){
 bundleBuildContext.onResolve({filter:/^\.\/(BattleActionPoints|battleActionPoints)$/},importPathRecord=>({path:resolve('src/ui',importPathRecord.path.endsWith('/BattleActionPoints')?'BattleActionPoints.tsx':'battleActionPoints.ts')}));
 bundleBuildContext.onResolve({filter:/^preact\/hooks$|^\.\.\/i18n$/},importPathRecord=>({path:importPathRecord.path,namespace:'render-test'}));
 bundleBuildContext.onLoad({filter:/.*/,namespace:'render-test'},importPathRecord=>({contents:importPathRecord.path==='preact/hooks'?
  'export const useState=(value)=>[typeof value==="function"?value():value,()=>{}];export const useRef=(value)=>({current:value});export const useEffect=()=>{};':
  'export const useTranslation=()=>({locale:"ko",t:(key)=>key});',loader:'js'}));
}}]});
const { BattlePanel } = await import(`data:text/javascript;base64,${Buffer.from(bundledPanelOutput.outputFiles[0].text).toString('base64')}`);
function collectRenderedNodes(currentRenderNode) {
 if (currentRenderNode == null || typeof currentRenderNode === 'boolean') return [];
 if (Array.isArray(currentRenderNode)) return currentRenderNode.flatMap(collectRenderedNodes);
 if (typeof currentRenderNode !== 'object') return [currentRenderNode];
 if (typeof currentRenderNode.type === 'function') return collectRenderedNodes(currentRenderNode.type(currentRenderNode.props));
 return [currentRenderNode,...collectRenderedNodes(currentRenderNode.props.children)];
}
test('음수 AP 전투는 오류 없이 소진 안내와 사용 가능한 턴 종료를 렌더링한다',()=>{
 const battleStateRecord={id:'battle',rulesVersion:'1.4.0',status:'ACTIVE',round:2,turnId:3,version:4,index:0,order:['me'],log:[],
  field:{columns:5,rows:5,cells:[],blocked:[]},tactics:{canAct:true,moves:[],attacks:[]},
  units:[{id:'me',name:'모험가',side:'ally',hp:25,maxHp:25,ap:-1,maxAp:6,position:{column:1,row:1}}]};
 const renderedPanelNodes=collectRenderedNodes(BattlePanel({me:{skills:{},battleSkillLoadout:[]},battle:battleStateRecord,actor:'me',selected:null,disabled:false,select:()=>{},execute:()=>{}}));
 assert.ok(renderedPanelNodes.includes('battle.apExhausted'));
 assert.ok(renderedPanelNodes.includes(-1));
 const endTurnButtonNode=renderedPanelNodes.find(renderedPanelNode=>renderedPanelNode?.type==='button'&&renderedPanelNode.props.children==='battle.endTurn');
 assert.equal(endTurnButtonNode.props.disabled,false);
});
