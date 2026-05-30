import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sourceFiles = [
  'pages/home/index.js',
  'pages/profile/index.js',
  'pages/login/index.js',
  'pages/product-detail/index.js',
  'pages/cart/index.js',
  'pages/orders/index.js',
  'pages/order-detail/index.js',
  'utils/api.js',
  'utils/request.js',
  'utils/format.js'
]

test('mini program local require paths use explicit js extensions', () => {
  for (const relativePath of sourceFiles) {
    const filename = path.join(__dirname, '..', relativePath)
    const code = fs.readFileSync(filename, 'utf8')
    const requireCalls = code.match(/require\((['"])([^'"]+)\1\)/g) || []

    for (const call of requireCalls) {
      const [, moduleId] = call.match(/require\((['"])([^'"]+)\1\)/)
      if (moduleId.startsWith('.')) {
        assert.equal(
          path.extname(moduleId),
          '.js',
          `${relativePath} should use an explicit .js extension for ${moduleId}`
        )
      }
    }
  }
})

test('home-critical shared utils do not depend on transitive local require chains', () => {
  const apiCode = fs.readFileSync(path.join(__dirname, '../utils/api.js'), 'utf8')
  const formatCode = fs.readFileSync(path.join(__dirname, '../utils/format.js'), 'utf8')

  assert.doesNotMatch(apiCode, /require\(['"]\.\/request(\.js)?['"]\)/)
  assert.doesNotMatch(formatCode, /require\(['"]\.\/config(\.js)?['"]\)/)
})
