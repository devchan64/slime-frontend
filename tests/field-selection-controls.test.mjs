import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parsePack } from '../src/i18n/catalog.mjs';

const fieldMessageCatalog = parsePack(await readFile('src/i18n/locales/ko/field.yaml', 'utf8'), 'field.yaml');
const { outputFiles: fieldBundleOutputs } = await build({
  loader: {'.css':'empty'},
  entryPoints: ['src/ui/FieldPanel.tsx'], bundle: true, write: false, platform: 'node', format: 'esm',
  jsx: 'automatic', jsxImportSource: 'preact', external: [pathToFileURL(resolve('src/i18n/catalog.mjs')).href],
  plugins: [{
    name: 'strict-field-translations',
    setup(pluginBuildContext) {
      pluginBuildContext.onResolve({ filter: /^\.\.\/i18n$/ }, () => ({ path: 'translations', namespace: 'field-test' }));
      pluginBuildContext.onLoad({ filter: /.*/, namespace: 'field-test' }, () => ({
        contents: `import {formatMessage} from ${JSON.stringify(pathToFileURL(resolve('src/i18n/catalog.mjs')).href)};
          const fieldMessageCatalog = ${JSON.stringify(fieldMessageCatalog)};
          export const t = (messageKey, messageValues) => formatMessage(fieldMessageCatalog[messageKey.replace('field.', '')], messageValues);
          export const getLocale = () => 'ko';
          export const useTranslation = () => ({t, locale:getLocale()});`,
        loader: 'js', resolveDir: process.cwd(),
      }));
    },
  }],
});
const { FieldSelection } = await import(`data:text/javascript;base64,${Buffer.from(fieldBundleOutputs[0].text).toString('base64')}`);

function collectActionButtons(currentRenderedNode) {
  if (!currentRenderedNode || typeof currentRenderedNode !== 'object') return [];
  if (Array.isArray(currentRenderedNode)) return currentRenderedNode.flatMap(collectActionButtons);
  return [
    ...(currentRenderedNode.type === 'button' ? [currentRenderedNode] : []),
    ...collectActionButtons(currentRenderedNode.props?.children),
  ];
}
function createSelectionFixture(currentMonsterEntries = []) {
  return {
    me: { mode: 'FIELD', hp: 25, fp: 100, position: { column: 0, row: 0 } },
    map: {
      name: '초원', columns: 4, rows: 4, blocked: [], connections: [],
      startPoint: { column: 0, row: 0 }, safeRadius: 0,
      terrainRows: ['gggg', 'gggg', 'gggg', 'gggg'], terrainCodes: { g: 'grass' },
      movementCosts: { version: 1, rows: [{ tileId: 'grass', fp: { baseCost: 1, extraChanceBasisPoints: 1000, extraCost: 1 } }] },
    },
    monsters: currentMonsterEntries,
  };
}
test('실제 번역 검증과 지형 비용을 사용해 이동 버튼을 렌더링하고 실행한다', () => {
  let movementCommandCount = 0;
  const renderedSelectionTree = FieldSelection({
    state: createSelectionFixture(), selected: { column: 2, row: 0 }, disabled: false, now: 0,
    select() {}, command() {}, walking: null, walk: () => movementCommandCount++, stop() {},
  });
  const movementActionButton = collectActionButtons(renderedSelectionTree).find(currentActionButton => !currentActionButton.props['aria-label']);
  assert.ok(movementActionButton);
  assert.equal(movementActionButton.props.disabled, false);
  movementActionButton.props.onClick();
  assert.equal(movementCommandCount, 1);
});
test('실제 번역 검증과 지형 비용을 사용해 원거리 몬스터 접근 버튼을 실행한다', () => {
  const requestedMonsterIds = [];
  const renderedSelectionTree = FieldSelection({
    state: createSelectionFixture([{ id: 'slime-test', name: '슬라임', state: 'AVAILABLE', disposition: 'PASSIVE', position: { column: 2, row: 0 } }]),
    selected: { column: 2, row: 0 }, disabled: false, now: 0,
    select() {}, command() {}, walking: null, walk() {}, stop() {},
    encounter: currentMonsterId => requestedMonsterIds.push(currentMonsterId),
  });
  const encounterActionButton = collectActionButtons(renderedSelectionTree).find(currentActionButton => !currentActionButton.props['aria-label']);
  assert.equal(encounterActionButton.props.disabled, false);
  encounterActionButton.props.onClick();
  assert.deepEqual(requestedMonsterIds, ['slime-test']);
});
