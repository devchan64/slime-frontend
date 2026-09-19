import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/client/response.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { readApiResponse, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const json = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

test('빈 프록시 오류를 API 서버 안내로 표시한다', async () => {
  await assert.rejects(readApiResponse(new Response('', { status: 500 })), error =>
    error instanceof ApiError && error.status === 500 && error.message.includes('API 서버 연결'));
});
test('HTML·잘린 JSON·빈 성공 응답은 성공 데이터로 처리하지 않는다', async () => {
  for (const response of [new Response('<html>error</html>', { status: 502 }), json('{'), json(''), json('null')])
    await assert.rejects(readApiResponse(response), error => error.code === 'INVALID_API_RESPONSE');
});
test('정상 객체·목록과 서버 오류 메시지를 보존한다', async () => {
  assert.deepEqual(await readApiResponse(json('{"ok":true}')), { ok: true });
  assert.deepEqual(await readApiResponse(json('[]')), []);
  await assert.rejects(readApiResponse(json('{"code":"INSUFFICIENT_CP","message":"CP가 부족합니다."}', 409)),
    error => error.code === 'INSUFFICIENT_CP' && error.message === 'CP가 부족합니다.');
});
