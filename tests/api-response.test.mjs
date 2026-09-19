import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/client/response.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { readApiResponse, readApiMessage, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
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

test('선택 언어의 서버 오류·성공 메시지를 사용하며 다른 필드는 유지한다', async () => {
  const body = JSON.stringify({code:'INSUFFICIENT_SP', message:'SP가 부족합니다.', messages:{ko:'SP가 부족합니다.', en:'Not enough SP.'}});
  await assert.rejects(readApiResponse(json(body,409), 'en'), error => error.message === 'Not enough SP.' && error.code === 'INSUFFICIENT_SP');
  await assert.rejects(readApiResponse(json(body,409), 'ko'), error => error.message === 'SP가 부족합니다.');
  const result = await readApiResponse(json(body), 'en');
  assert.equal(result.message, 'Not enough SP.');
  assert.equal(result.messages.ko, 'SP가 부족합니다.');
});
test('언어가 누락되거나 추가된 messages는 원문으로 숨기지 않는다', async () => {
  for (const messages of [{ko:'안내'}, {ko:'안내',en:''}, {ko:'안내',en:'Notice',ja:'案内'}, ['안내','Notice'], null]) {
    await assert.rejects(readApiResponse(json(JSON.stringify({message:'안내',messages}),409),'en'), error => error.code === 'INVALID_API_RESPONSE');
  }
});
test('영문 선택 시 프록시 오류도 영문으로 안내한다', async () => {
  await assert.rejects(readApiResponse(new Response('', {status:502}), 'en'), error => error.message.includes('Check the API connection'));
});

test('WebSocket 오류에도 같은 두 언어 계약을 사용한다', () => {
  const frame = {type:'error', code:'SESSION_EXPIRED', message:'만료', messages:{ko:'세션이 만료되었습니다.', en:'Your session has expired.'}};
  assert.equal(readApiMessage(frame, 'en'), 'Your session has expired.');
  assert.equal(readApiMessage(frame, 'ko'), '세션이 만료되었습니다.');
  assert.throws(() => readApiMessage({...frame, messages:{ko:'만료'}}, 'en'));
  assert.equal(readApiMessage({message:'이전 서버 안내'}, 'en'), '이전 서버 안내');
});
