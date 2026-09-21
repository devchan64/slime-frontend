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
        ? 'export const useState=value=>[value,()=>{}]; export const useRef=value=>({current:value}); export const useEffect=callback=>globalThis.actionCutinTestRuntime.effects.push(callback);'
        : importedModuleRecord.path === '../i18n'
          ? 'export const useTranslation=()=>({t:key=>key});'
          : 'export const resolveActionCutinAsset=()=>"/test.png"; export const resolveActionCutinFrame=()=>null;',
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
