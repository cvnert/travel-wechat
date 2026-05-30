import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const templateChecks = [
  {
    file: 'pages/home/index.wxml',
    forbidden: [/\{\{[^}]*&&[^}]*\}\}/, /\{\{[^}]*\|\|[^}]*\}\}/]
  },
  {
    file: 'pages/product-detail/index.wxml',
    forbidden: [/\{\{[^}]*\|\|[^}]*\}\}/]
  },
  {
    file: 'pages/cart/index.wxml',
    forbidden: [
      /\{\{[^}]*&&[^}]*\}\}/,
      /\{\{[^}]*===?[^}]*\}\}/,
      /\{\{[^}]*\|\|[^}]*\}\}/,
      /\{\{[^}]*\?[^}]*:[^}]*\}\}/
    ]
  },
  {
    file: 'pages/orders/index.wxml',
    forbidden: [/\{\{[^}]*===?[^}]*\}\}/, /\{\{[^}]*\|\|[^}]*\}\}/, /\{\{[^}]*\?[^}]*:[^}]*\}\}/]
  },
  {
    file: 'pages/order-detail/index.wxml',
    forbidden: [
      /\{\{[^}]*&&[^}]*\}\}/,
      /\{\{[^}]*!order[^}]*\}\}/,
      /\{\{[^}]*===?[^}]*\}\}/,
      /\{\{[^}]*\|\|[^}]*\}\}/,
      /\{\{[^}]*\?[^}]*:[^}]*\}\}/
    ]
  },
  {
    file: 'pages/profile/index.wxml',
    forbidden: [
      /\{\{[^}]*![^}]*\}\}/,
      /\{\{[^}]*\?[^}]*:[^}]*\}\}/
    ]
  }
]

test('checkout flow templates keep logic out of WXML bindings', () => {
  for (const check of templateChecks) {
    const source = fs.readFileSync(path.join(__dirname, '..', check.file), 'utf8')
    for (const pattern of check.forbidden) {
      assert.doesNotMatch(source, pattern, `${check.file} should avoid ${pattern}`)
    }
  }
})
