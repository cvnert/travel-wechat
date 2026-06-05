import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readWxml(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

test('critical wxml files do not contain malformed closing tags', () => {
  const files = [
    'pages/profile/index.wxml',
    'pages/orders/index.wxml'
  ]

  for (const file of files) {
    const source = readWxml(file)
    assert.doesNotMatch(
      source,
      /[^<]\/(view|button|text|image|scroll-view|swiper-item|swiper)>/,
      `${file} contains a malformed closing tag`
    )
  }
})
