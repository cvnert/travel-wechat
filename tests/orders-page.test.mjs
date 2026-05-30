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
    '../../utils/api': {}
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

  assert.match(styles, /\.tab\s*\{[\s\S]*min-width:\s*128rpx;/)
  assert.match(styles, /\.tab\s*\{[\s\S]*margin-right:\s*12rpx;/)
  assert.match(styles, /\.tab\s*\{[\s\S]*padding:\s*14rpx 18rpx;/)
  assert.match(styles, /\.tab\s*\{[\s\S]*font-size:\s*24rpx;/)
})

test('orders footer keeps summary text separated from action button', () => {
  const filename = path.join(__dirname, '../pages/orders/index.wxss')
  const styles = fs.readFileSync(filename, 'utf8')

  assert.match(styles, /\.order-foot\s*\{[\s\S]*padding-top:\s*22rpx;/)
  assert.match(styles, /\.order-foot\s*\{[\s\S]*border-top:\s*1rpx solid #edf0f5;/)
  assert.match(styles, /\.order-foot\s*\{[\s\S]*gap:\s*28rpx;/)
  assert.match(styles, /\.order-actions\s*\{[\s\S]*padding-left:\s*20rpx;/)
})
