import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const { outputFiles: stillshotAssetOutputs } = await build({
  entryPoints: ['src/ui/stillshotAssets.ts'], bundle: true, write: false, format: 'esm', platform: 'browser',
  define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('src/ui/stillshotAssets.ts')).href) },
  plugins: [{ name: 'stillshot-yaml-source', setup(pluginBuildContext) {
    pluginBuildContext.onResolve({ filter: /\.yaml\?raw$/ }, importSourceRecord => ({ path: resolve(importSourceRecord.resolveDir, importSourceRecord.path.slice(0, -4)), namespace: 'stillshot-yaml' }));
    pluginBuildContext.onLoad({ filter: /.*/, namespace: 'stillshot-yaml' }, async importSourceRecord => ({ contents: await readFile(importSourceRecord.path, 'utf8'), loader: 'text' }));
  } }],
});
const { resolveStillshotAsset, parseStillshotCatalog } = await import(`data:text/javascript;base64,${Buffer.from(stillshotAssetOutputs[0].text).toString('base64')}`);
const defaultCharacterGroups = { kind: 'character', groups: { costume: 'default-v1', hair: 'default-v1', face: 'default-v1' } };
test('코스튬·헤어·얼굴의 등록된 전체 조합만 연결한다', () => {
  assert.match(resolveStillshotAsset(defaultCharacterGroups), /characters\/default-v1\.png$/);
  for (const appearanceGroupKey of ['costume', 'hair', 'face']) {
    assert.throws(() => resolveStillshotAsset({ ...defaultCharacterGroups, groups: { ...defaultCharacterGroups.groups, [appearanceGroupKey]: 'unknown' } }), /조합/);
  }
  assert.match(resolveStillshotAsset({ kind: 'monster', group: 'slime' }), /slime-v2\.png$/);
  assert.throws(() => resolveStillshotAsset({ kind: 'monster', group: '__proto__' }), /조합/);
});
test('잘못된 YAML·중복 그룹·알 수 없는 필드·없는 이미지 참조는 거절한다', () => {
  for (const invalidCatalogSource of [
    '- kind: monster\n  kind: character\n',
    '- kind: monster\n  group: slime\n  asset: slime\n  unknown: true\n',
    '- kind: monster\n  group: 1\n  asset: slime\n',
    '- kind: monster\n  group: slime\n  asset: missing\n',
    '- kind: monster\n  group: slime\n  asset: slime\n- kind: monster\n  group: slime\n  asset: slime\n',
  ]) assert.throws(() => parseStillshotCatalog(invalidCatalogSource), /스틸샷/);
});
