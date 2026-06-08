import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadPage(requireMap = {}, wxOverrides = {}) {
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
    wx: wxOverrides
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
  assert.equal(typeof page.callService, 'undefined')
  assert.doesNotMatch(wxml, /店铺/)
  assert.doesNotMatch(wxml, /客服/)
  assert.doesNotMatch(wxml, /bindtap="openHome"/)
  assert.doesNotMatch(wxml, /bindtap="callService"/)
})

test('product detail page keeps travel date selection on the booking page', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/product-detail/index.wxml'), 'utf8')

  assert.match(wxml, /<scroll-view class="detail-scroll" scroll-y="\{\{detailScrollEnabled\}\}">/)
  assert.doesNotMatch(wxml, /选择出发日期/)
  assert.doesNotMatch(wxml, /<van-calendar/)
  assert.doesNotMatch(wxml, /bindtap="openTravelDrawer"/)
})

test('product detail buy action navigates to booking page', async () => {
  let navigatedUrl = ''
  const page = loadPage({
    '../../utils/api': {
      async addCartItem() {}
    },
    '../../utils/auth': { requireLogin: () => true },
    '../../utils/format': { formatPrice: (value) => String(value) },
    '../../utils/travel-date': { buildTravelDateCalendar: () => ({ months: [], days: [], selectedDate: '', selectedDay: null, selectedPriceText: '0' }) }
  }, {
    navigateTo(options) {
      navigatedUrl = options.url
    },
    switchTab() {},
    showToast() {}
  })
  const instance = {
    data: {
      product: { id: 'product-1' },
      actionLoading: false
    },
    setData(update) {
      Object.assign(this.data, update)
    },
    refreshCartCount: async () => {}
  }
  await page.reserve.call(instance)

  assert.equal(navigatedUrl, '/pages/booking/index?id=product-1')
})
