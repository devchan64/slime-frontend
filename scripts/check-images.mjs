import { fileURLToPath } from 'node:url';
import { mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateImages } from './image-assets.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const logs = resolve(root, 'node_modules/.cache');
mkdirSync(logs, { recursive: true });
function log(stage, message) {
  const line = `[${new Date().toISOString()}/image-assets/${stage}] ${message}`;
  console.log(line);
  appendFileSync(resolve(logs, 'image-assets.log'), line + '\n');
}
log('start', '이미지 관리 ID·파일명·경로 검사');
try { log('complete', `${validateImages(root)}개 이미지 검증 완료`); }
catch (error) { log('failed', error.stack); process.exitCode = 1; }
