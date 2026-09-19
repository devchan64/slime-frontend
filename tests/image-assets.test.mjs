import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { validateImages } from '../scripts/image-assets.mjs';
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'slime-images-'));
  mkdirSync(join(root, 'src')); mkdirSync(join(root, 'public'));
  writeFileSync(join(root, 'src/a.png'), '');
  const registry = {managementId:'registry.images.test', data:{version:1, images:[{managementId:'image.test.a', path:'src/a.png'}]}};
  const save = () => writeFileSync(join(root, 'image-assets.yaml'), stringify(registry));
  try { save(); run(root, registry, save); } finally { rmSync(root, {recursive:true, force:true}); }
}
test('파일 이름이 변경되어도 관리 ID를 보존한다', () => fixture((root, registry, save) => {
  assert.equal(validateImages(root), 1);
  renameSync(join(root, 'src/a.png'), join(root, 'src/b.png'));
  registry.data.images[0].path = 'src/b.png'; save();
  assert.equal(validateImages(root), 1);
  assert.equal(registry.data.images[0].managementId, 'image.test.a');
}));
test('새 파일 미등록과 삭제된 파일을 거부한다', () => fixture((root) => {
  writeFileSync(join(root, 'public/new.svg'), '');
  assert.throws(() => validateImages(root), /미등록/);
  rmSync(join(root, 'public/new.svg')); rmSync(join(root, 'src/a.png'));
  assert.throws(() => validateImages(root), /파일이 없거나/);
}));
test('중복 관리 ID와 동일 파일 중복 등록을 거부한다', () => fixture((root, registry, save) => {
  registry.data.images.push({...registry.data.images[0], path:'src/b.png'}); save();
  assert.throws(() => validateImages(root), /관리 ID/);
  registry.data.images[1] = {managementId:'image.test.b', path:'src/a.png'}; save();
  assert.throws(() => validateImages(root), /경로 오류·중복/);
}));
test('경로 탈출, 누락 필드, 알 수 없는 필드와 YAML 중복 키를 거부한다', () => fixture((root, registry, save) => {
  registry.data.images[0].path = '../a.png'; save();
  assert.throws(() => validateImages(root), /경로/);
  registry.data.images[0] = {path:'src/a.png'}; save();
  assert.throws(() => validateImages(root), /필드/);
  registry.data.images[0] = {managementId:'image.test.a', path:'src/a.png', unknown:1}; save();
  assert.throws(() => validateImages(root), /필드/);
  writeFileSync(join(root, 'image-assets.yaml'), 'managementId: a\nmanagementId: b\ndata: {}');
  assert.throws(() => validateImages(root));
}));
