import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadPage(requireMap = {}) {
  const filename = path.join(__dirname, '../pages/product-detail/index.js')
  const code = fs.readFileSync(filename, 'utf8')
  let pageConfig = null
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(id) {
      const normalizedId = id.replace(/\.js$/, '')
      if (id in requireMap) {
        return requireMap[id]
      }
      if (normalizedId in requireMap) {
        return requireMap[normalizedId]
      }
      throw new Error(`unexpected require: ${id}`)
    },
    Page(config) {
      pageConfig = config
    },
    wx: {}
  }
  vm.runInNewContext(code, sandbox, { filename })
  return pageConfig
}

test('product detail page exposes taobao-style bottom actions', () => {
  const page = loadPage({
    '../../utils/api': {},
    '../../utils/auth': { requireLogin: () => true },
    '../../utils/format': { formatPrice: (value) => String(value) },
    '../../utils/travel-date': { buildTravelDateCalendar: () => ({ months: [], days: [], selectedDate: '', selectedDay: null, selectedPriceText: '0' }) }
  })
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/product-detail/index.wxml'), 'utf8')

  assert.ok(page)
  assert.equal(page.data.cartCount, 0)
  assert.equal(typeof page.openCart, 'function')
  assert.equal(typeof page.refreshCartCount, 'function')
  assert.doesNotMatch(wxml, /店铺/)
  assert.doesNotMatch(wxml, /bindtap="openHome"/)
})

test('product detail page locks background scroll while the travel drawer is open', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/product-detail/index.wxml'), 'utf8')
  const json = fs.readFileSync(path.join(__dirname, '../pages/product-detail/index.json'), 'utf8')

  assert.match(wxml, /<scroll-view class="detail-scroll" scroll-y="\{\{detailScrollEnabled\}\}">/)
  assert.match(wxml, /<van-calendar/)
  assert.match(wxml, /custom-class="travel-calendar"/)
  assert.match(wxml, /root-portal="\{\{true\}\}"/)
  assert.doesNotMatch(wxml, /确认/)
  assert.doesNotMatch(wxml, /取消/)
  assert.match(json, /van-calendar/)
})
