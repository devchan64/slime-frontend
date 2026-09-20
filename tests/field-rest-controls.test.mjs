import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles: restControlOutputs } = await build({entryPoints:['src/ui/FieldRestControls.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',plugins:[{
 name:'rest-control-translations', setup(pluginBuildContext) {
  pluginBuildContext.onResolve({filter:/^\.\.\/i18n$/}, () => ({path:'translations',namespace:'rest-control-test'}));
  pluginBuildContext.onLoad({filter:/.*/,namespace:'rest-control-test'}, () => ({contents:'export const useTranslation=()=>({t:(messageKey,values)=>values ? messageKey+JSON.stringify(values) : messageKey});',loader:'js'}));
 },
}]});
const { FieldRestControls } = await import(`data:text/javascript;base64,${Buffer.from(restControlOutputs[0].text).toString('base64')}`);
function createRestControls(currentPlayerState, actionsAreDisabled=false) {
 const submittedCommandPaths = [];
 const renderedControlTree = FieldRestControls({currentPlayerState,currentServerTime:100,actionsAreDisabled,submitRestCommand: commandPathValue => submittedCommandPaths.push(commandPathValue)});
 return {renderedControlTree,submittedCommandPaths};
}
const initialRestState = {mode:'FIELD',hp:0,fp:0,fieldRest:{active:false,startedAt:null,nextRecoveryAt:null,recoveryPerMinute:3}};
test('HP 0과 FP 0에서도 휴식 시작 버튼이 활성화되어 시작 API를 호출한다', () => {
 const {renderedControlTree,submittedCommandPaths} = createRestControls(initialRestState);
 const restActionButton = renderedControlTree.props.children[0];
 assert.equal(restActionButton.props.disabled,false);
 restActionButton.props.onClick();
 assert.deepEqual(submittedCommandPaths,['/v1/game/rest/start']);
});
test('음수 FP는 시작만 막고 진행 중인 휴식 종료는 허용한다', () => {
 assert.equal(createRestControls({...initialRestState,fp:-1}).renderedControlTree.props.children[0].props.disabled,true);
 const {renderedControlTree,submittedCommandPaths} = createRestControls({...initialRestState,fp:-1,fieldRest:{active:true,startedAt:60,nextRecoveryAt:120,recoveryPerMinute:3}});
 assert.equal(renderedControlTree.props.children[0].props.disabled,false);
 renderedControlTree.props.children[0].props.onClick();
 assert.deepEqual(submittedCommandPaths,['/v1/game/rest/stop']);
 assert.match(renderedControlTree.props.children[1].props.children, /"seconds":20/);
});
test('전투·준비 중이거나 명령 대기 중이면 휴식을 잠그고 구버전 응답에는 노출하지 않는다', () => {
 for (const currentModeValue of ['IN_BATTLE','RESERVED','AWAY']) {
  assert.equal(createRestControls({...initialRestState,mode:currentModeValue}).renderedControlTree.props.children[0].props.disabled,true);
 }
 assert.equal(createRestControls(initialRestState,true).renderedControlTree.props.children[0].props.disabled,true);
 assert.equal(createRestControls({mode:'FIELD'}).renderedControlTree,null);
});
