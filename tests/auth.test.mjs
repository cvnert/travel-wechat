import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRequireLogin } from '../utils/auth.mjs'

test('browsing product pages does not require login', () => {
  assert.equal(shouldRequireLogin('browse'), false)
})

test('reservation requires login', () => {
  assert.equal(shouldRequireLogin('reserve'), true)
})
