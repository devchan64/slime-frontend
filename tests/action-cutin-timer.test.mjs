import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const actionCutinTestRuntime = { effects: [], timers: [], cleared: [] };
globalThis.actionCutinTestRuntime = actionCutinTestRuntime;
const actionCutinBuildResult = await build({
  entryPoints: ['src/ui/ActionCutin.tsx'], bundle: true, write: false, format: 'esm',
  platform: 'node', jsx: 'automatic', jsxImportSource: 'preact',
  plugins: [{ name: 'cutin-timer-test', setup(bundleBuildContext) {
    bundleBuildContext.onResolve({ filter: /^(preact\/hooks|\.\.\/i18n|\.\/actionCutinAssets)$/ },
      importedModuleRecord => ({ path: importedModuleRecord.path, namespace: 'cutin-test' }));
    bundleBuildContext.onLoad({ filter: /.*/, namespace: 'cutin-test' }, importedModuleRecord => ({
      contents: importedModuleRecord.path === 'preact/hooks'
        ? 'export const useId=()=>"cutin-test-clip"; export const useState=value=>[value,()=>{}]; export const useRef=value=>({current:value}); export const useEffect=callback=>globalThis.actionCutinTestRuntime.effects.push(callback);'
        : importedModuleRecord.path === '../i18n'
          ? 'export const useTranslation=()=>({t:key=>key});'
          : 'export const resolveActionCutinAsset=()=>{if(globalThis.actionCutinTestRuntime.assetFailure)throw new Error("unregistered");return "/test.png";}; export const resolveActionCutinFrame=()=>null;',
      loader: 'js',
    }));
  } }],
});
const { ActionCutinOverlay } = await import(`data:text/javascript;base64,${Buffer.from(actionCutinBuildResult.outputFiles[0].text).toString('base64')}`);
function collectCutinElements(currentRenderNode) {
  if (Array.isArray(currentRenderNode)) return currentRenderNode.flatMap(collectCutinElements);
  if (!currentRenderNode || typeof currentRenderNode !== 'object') return [];
  if (typeof currentRenderNode.type === 'function') return collectCutinElements(currentRenderNode.type(currentRenderNode.props));
  return [currentRenderNode, ...collectCutinElements(currentRenderNode.props?.children)];
}
for (const configuredDurationSeconds of [1, 2, 3]) {
  test(`${configuredDurationSeconds}초 후 이미지 로드와 무관하게 종료하고 건너뛰기 버튼을 제공하지 않는다`, () => {
    actionCutinTestRuntime.effects = [];
    actionCutinTestRuntime.timers = [];
    actionCutinTestRuntime.cleared = [];
    const previousWindowObject = globalThis.window;
    globalThis.window = {
      setTimeout(timerCallbackFunction, timerDurationMilliseconds) {
        actionCutinTestRuntime.timers.push({ timerCallbackFunction, timerDurationMilliseconds });
        return 17;
      },
      clearTimeout(timerIdentityValue) { actionCutinTestRuntime.cleared.push(timerIdentityValue); },
    };
    let finishedCutinCount = 0;
    try {
      const renderedCutinNode = ActionCutinOverlay({
        actionCutinEventRecord: { actionType: 'ATTACK', actorName: '모험가', appearance: {} },
        actionCutinDurationSeconds: configuredDurationSeconds,
        finishActionCutinDisplay: () => { finishedCutinCount += 1; },
      });
      const cleanupCutinTimer = actionCutinTestRuntime.effects[0]();
      assert.equal(actionCutinTestRuntime.timers[0].timerDurationMilliseconds, configuredDurationSeconds * 1000);
      assert.equal(finishedCutinCount, 0);
      const renderedCutinElements = collectCutinElements(renderedCutinNode);
      assert.equal(renderedCutinElements.some(renderedChildNode => renderedChildNode.type === 'button'), false);
      const renderedCutinImage = renderedCutinElements.find(renderedChildNode => renderedChildNode.type === 'img');
      assert.ok(renderedCutinImage, '컷인 이미지가 렌더링되어야 합니다.');
      renderedCutinImage.props.onError();
      assert.equal(finishedCutinCount, 0);
      actionCutinTestRuntime.timers[0].timerCallbackFunction();
      assert.equal(finishedCutinCount, 1);
      cleanupCutinTimer();
      assert.deepEqual(actionCutinTestRuntime.cleared, [17]);
    } finally { globalThis.window = previousWindowObject; }
  });
}


test('미등록 외형 오류는 국소 안내로 표시하고 기존 타이머로 종료한다', () => {
  actionCutinTestRuntime.effects=[];
  actionCutinTestRuntime.assetFailure=true;
  const previous_window_object=globalThis.window;
  let current_finish_count=0;
  let current_timer_callback;
  globalThis.window={setTimeout(current_callback){current_timer_callback=current_callback;return 1;},clearTimeout(){}};
  try {
    const current_render_node=ActionCutinOverlay({actionCutinEventRecord:{actionType:'ATTACK',actorName:'모험가',appearance:{}},actionCutinDurationSeconds:1,finishActionCutinDisplay:()=>{current_finish_count++;}});
    const current_render_elements=collectCutinElements(current_render_node);
    assert.ok(current_render_elements.some(current_child_node=>current_child_node.props?.role==='alert'));
    assert.equal(current_render_elements.some(current_child_node=>current_child_node.type==='img'),false);
    const dispose_timer_callback=actionCutinTestRuntime.effects[0]();
    current_timer_callback();
    assert.equal(current_finish_count,1);
    dispose_timer_callback();
  } finally {globalThis.window=previous_window_object;actionCutinTestRuntime.assetFailure=false;}
});
