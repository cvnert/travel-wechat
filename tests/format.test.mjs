import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, normalizeImageUrl } from '../utils/format.mjs'

test('formatPrice keeps two decimals and yuan symbol', () => {
  assert.equal(formatPrice(1288), '￥1288.00')
  assert.equal(formatPrice('99.9'), '￥99.90')
})

test('formatPrice handles invalid values as zero', () => {
  assert.equal(formatPrice(undefined), '￥0.00')
  assert.equal(formatPrice('bad'), '￥0.00')
})

test('normalizeImageUrl keeps absolute urls', () => {
  assert.equal(normalizeImageUrl('https://example.com/a.png', 'http://localhost:8080'), 'https://example.com/a.png')
})

test('normalizeImageUrl prefixes relative urls', () => {
  assert.equal(normalizeImageUrl('/uploads/a.png', 'http://localhost:8080'), 'http://localhost:8080/uploads/a.png')
})
