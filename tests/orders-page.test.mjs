import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadPage(relativePath, requireMap = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const code = fs.readFileSync(filename, 'utf8')
  let pageConfig = null
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
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

function loadModule(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  const code = fs.readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    require() {
      throw new Error(`unexpected require in ${relativePath}`)
    }
  }
  vm.runInNewContext(code, sandbox, { filename })
  return module.exports
}

test('orders page exposes payment and travel lifecycle tabs', () => {
  const orderUtils = loadModule('utils/order.js')
  const page = loadPage('pages/orders/index.js', {
    '../../utils/api': {},
    '../../utils/auth': { requireLogin: () => true },
    '../../utils/format': { formatPrice: (value) => String(value) },
    '../../utils/order': orderUtils,
    '../../utils/payment': {
      requestWechatPayment() {},
      waitForPaidOrder() {
        return null
      },
      isPaymentCancelled() {
        return false
      },
      isOrderPaid(order) {
        return Boolean(order) && String(order.paymentStatus || '').toLowerCase() === 'paid'
      }
    }
  })

  assert.ok(page)
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.data.statusTabs)).map((item) => ({
      key: item.key,
      label: item.label
    })),
    [
      { key: '', label: '全部' },
      { key: 'pending_payment', label: '待支付' },
      { key: 'pending_travel', label: '待出行' },
      { key: 'completed', label: '已出行' }
    ]
  )
  assert.equal(page.data.statusTabs[0].tabClass, 'tab tab-active')
  assert.equal(typeof page.openOrderDetail, 'function')
})

test('profile shortcuts send paid users to pending travel orders', () => {
  const page = loadPage('pages/profile/index.js', {
    '../../utils/api': {},
    '../../utils/wechat-auth': {}
  })

  assert.ok(page)
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.data.orderItems)).map((item) => item.key),
    [
      'pay',
      'travel',
      'done',
      'all',
      'cart'
    ]
  )

  assert.ok(page.data.memberShortcuts.every((item) => item.icon.endsWith('.svg')))
  assert.ok(page.data.orderItems.every((item) => item.icon.endsWith('.svg')))
  assert.ok(page.data.menuItems.every((item) => item.icon.endsWith('.svg')))

  let receivedStatus = ''
  page.openOrders = ({ currentTarget }) => {
    receivedStatus = currentTarget.dataset.status || ''
  }
  page.handleOrderShortcut({
    currentTarget: {
      dataset: {
        key: 'travel'
      }
    }
  })

  assert.equal(receivedStatus, 'pending_travel')
})

test('orders tabs use compact pill sizing', () => {
  const filename = path.join(__dirname, '../pages/orders/index.wxss')
  const styles = fs.readFileSync(filename, 'utf8')

  assert.match(styles, /\.tabs-shell\s*\{/)
  assert.match(styles, /\.tab\s*\{[\s\S]*min-width:\s*136rpx;/)
  assert.match(styles, /\.tab\s*\{[\s\S]*margin-right:\s*10rpx;/)
  assert.match(styles, /\.tab\s*\{[\s\S]*padding:\s*16rpx 20rpx;/)
  assert.match(styles, /\.tab\s*\{[\s\S]*font-size:\s*24rpx;/)
  assert.match(styles, /\.tab-active\s*\{[\s\S]*background:\s*#172338;/)
})

test('orders footer keeps summary text separated from action button', () => {
  const filename = path.join(__dirname, '../pages/orders/index.wxss')
  const styles = fs.readFileSync(filename, 'utf8')

  assert.match(styles, /\.order-foot\s*\{[\s\S]*align-items:\s*flex-end;/)
  assert.match(styles, /\.order-foot\s*\{[\s\S]*padding-top:\s*18rpx;/)
  assert.match(styles, /\.order-foot\s*\{[\s\S]*border-top:\s*1rpx solid #edf0f5;/)
  assert.match(styles, /\.order-foot\s*\{[\s\S]*gap:\s*24rpx;/)
  assert.match(styles, /\.pay-button,\s*[\r\n\s]*\.detail-button\s*\{[\s\S]*min-width:\s*216rpx;/)
})

test('orders page uses the e-commerce card hierarchy for header, items, and footer', () => {
  const source = fs.readFileSync(path.join(__dirname, '../pages/orders/index.js'), 'utf8')
  const markup = fs.readFileSync(path.join(__dirname, '../pages/orders/index.wxml'), 'utf8')
  const styles = fs.readFileSync(path.join(__dirname, '../pages/orders/index.wxss'), 'utf8')

  assert.match(source, /function buildOrderHintText/)
  assert.match(source, /createdAtText/)
  assert.match(markup, /class="tabs-shell"/)
  assert.match(markup, /class="order-head-main"/)
  assert.match(markup, /class="order-hint order-hint-\{\{order\.statusTone\}\}"/)
  assert.match(markup, /class="order-items"/)
  assert.match(markup, /class="item-side"/)
  assert.match(markup, /class="order-summary"/)
  assert.match(markup, /class="order-total-amount"/)
  assert.match(styles, /\.order-item\s*\{[\s\S]*border-radius:\s*24rpx;/)
  assert.match(styles, /\.item-side\s*\{/)
  assert.match(styles, /\.order-summary\s*\{/)
  assert.match(styles, /\.pay-button\s*\{[\s\S]*linear-gradient\(135deg, #2d7ef7 0%, #2463eb 100%\);/)
})

test('profile page uses the simplified travel-brand member card layout', () => {
  const markup = fs.readFileSync(path.join(__dirname, '../pages/profile/index.wxml'), 'utf8')
  const styles = fs.readFileSync(path.join(__dirname, '../pages/profile/index.wxss'), 'utf8')

  assert.match(markup, /class="member-top"/)
  assert.match(markup, /class="member-shortcuts"/)
  assert.match(markup, /class="member-shortcut"/)
  assert.match(markup, /class="member-shortcut-icon"/)
  assert.match(markup, /class="order-icon-image"/)
  assert.match(markup, /class="row-icon-image"/)
  assert.doesNotMatch(markup, /<view class="row-icon">车<\/view>/)
  assert.doesNotMatch(markup, /<view class="order-icon">\{\{item\.icon\}\}<\/view>/)
  assert.doesNotMatch(markup, /member-note/)
  assert.doesNotMatch(markup, /member-code/)
  assert.doesNotMatch(markup, /hero-ridge/)

  assert.match(styles, /\.member-shortcuts\s*\{/)
  assert.match(styles, /\.member-shortcut\s*\{/)
  assert.match(styles, /\.member-shortcut-icon\s*\{/)
  assert.match(styles, /\.row-icon-image\s*\{/)
  assert.match(styles, /\.order-icon-image\s*\{/)
  assert.match(styles, /\.member-primary-button\s*\{/)
  assert.doesNotMatch(styles, /\.member-card-bottom\s*\{/)
  assert.doesNotMatch(styles, /\.hero-ridge-back\s*\{/)
})

test('profile page icon assets exist', () => {
  const filenames = [
    'order-pay.svg',
    'order-travel.svg',
    'order-done.svg',
    'order-all.svg',
    'order-cart.svg'
  ]

  filenames.forEach((filename) => {
    assert.ok(fs.existsSync(path.join(__dirname, '../assets', filename)))
  })
})
