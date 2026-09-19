import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePack, validatePair, formatMessage } from '../src/i18n/catalog.mjs';
test('언어팩은 중복 키·비문자 값·잘못된 키를 거부한다', () => {
  for (const yaml of ['title: A\ntitle: B', 'title: 1', 'title: ""', 'bad-key: text', '- text']) assert.throws(() => parsePack(yaml, 'test'));
});
test('키 누락과 추가, 치환 변수 불일치는 즉시 실패한다', () => {
  assert.throws(() => validatePair({title:'A'}, {}, 'en'));
  assert.throws(() => validatePair({}, {title:'A'}, 'en'));
  assert.throws(() => validatePair({title:'{count}'}, {title:'{name}'}, 'en'));
  validatePair({title:'{count}개'}, {title:'{count} items'}, 'en');
});
test('치환은 모든 필수 변수를 요구하며 전달 값을 재해석하지 않는다', () => {
  assert.equal(formatMessage('{count} items', {count:5}), '5 items');
  assert.equal(formatMessage('{name}', {name:'<script>{count}</script>'}), '<script>{count}</script>');
  assert.throws(() => formatMessage('{count}'));
  assert.throws(() => formatMessage('Hello', {count:1}));
});
