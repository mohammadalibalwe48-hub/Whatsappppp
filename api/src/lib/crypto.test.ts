import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual } from './crypto';

describe('safeEqual', () => {
  test('returns true for identical ascii strings', () => {
    assert.strictEqual(safeEqual('hello', 'hello'), true);
    assert.strictEqual(safeEqual('1234567890', '1234567890'), true);
  });

  test('returns false for different strings of same length', () => {
    assert.strictEqual(safeEqual('hello', 'world'), false);
    assert.strictEqual(safeEqual('hello', 'hellO'), false); // case sensitivity
  });

  test('returns false for different strings of different lengths', () => {
    assert.strictEqual(safeEqual('hello', 'hello!'), false);
    assert.strictEqual(safeEqual('hello', 'hell'), false);
    assert.strictEqual(safeEqual('', 'hello'), false);
  });

  test('returns true for empty strings', () => {
    assert.strictEqual(safeEqual('', ''), true);
  });

  test('handles multi-byte unicode characters properly', () => {
    // Emojis and foreign characters
    assert.strictEqual(safeEqual('你好', '你好'), true);
    assert.strictEqual(safeEqual('你好', '再见'), false);
    assert.strictEqual(safeEqual('🚀🚀🚀', '🚀🚀🚀'), true);
    assert.strictEqual(safeEqual('🚀🚀🚀', '🚀🚀'), false);
  });

  test('handles extremely long strings', () => {
    const str1 = 'a'.repeat(100000);
    const str2 = 'a'.repeat(100000);
    const str3 = 'a'.repeat(99999) + 'b';
    const str4 = 'a'.repeat(100001);

    assert.strictEqual(safeEqual(str1, str2), true);
    assert.strictEqual(safeEqual(str1, str3), false);
    assert.strictEqual(safeEqual(str1, str4), false);
  });
});
