import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadBookingPage({
  api = {},
  auth = { requireLogin: () => true },
  payment = {},
  wx = {}
} = {}) {
  const filename = path.join(__dirname, '../pages/booking/index.js')
  const code = fs.readFileSync(filename, 'utf8')
  let pageConfig = null
  const sandbox = {
    require(id) {
      const normalizedId = id.replace(/\.js$/, '')
      if (normalizedId === '../../utils/api') return api
      if (normalizedId === '../../utils/auth') return auth
      if (normalizedId === '../../utils/format') return { formatPrice: (value) => `¥${Number(value || 0).toFixed(2)}` }
      if (normalizedId === '../../utils/travel-date') {
        return {
          buildTravelDateCalendar(days, selectedDate) {
            const selectedDay = (days || []).find((item) => item.date === selectedDate) || (days || [])[0] || null
            return {
              days: days || [],
              selectedDate: selectedDay ? selectedDay.date : '',
              selectedDay,
              selectedPriceText: selectedDay ? `¥${Number(selectedDay.price).toFixed(2)}` : '¥0.00'
            }
          },
          buildFallbackPriceCalendar() {
            return []
          }
        }
      }
      if (normalizedId === '../../utils/payment') {
        return {
          requestWechatPayment: payment.requestWechatPayment || (async () => {}),
          waitForPaidOrder: payment.waitForPaidOrder || (async () => null),
          isPaymentCancelled: payment.isPaymentCancelled || (() => false),
          isOrderPaid: payment.isOrderPaid || ((order) => Boolean(order) && order.paymentStatus === 'paid')
        }
      }
      throw new Error(`unexpected require: ${id}`)
    },
    Page(config) {
      pageConfig = config
    },
    wx: {
      showToast() {},
      showLoading() {},
      hideLoading() {},
      navigateTo() {},
      redirectTo() {},
      setNavigationBarTitle() {},
      ...wx
    }
  }
  vm.runInNewContext(code, sandbox, { filename })
  return {
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    ...pageConfig,
    setData(update) {
      Object.assign(this.data, update)
    }
  }
}

test('booking page validates traveler profile before creating order', async () => {
  let toastTitle = ''
  let createOrderCalls = 0
  const page = loadBookingPage({
    api: {
      async createDirectOrder() {
        createOrderCalls += 1
        return { order: { id: 'order-1' } }
      }
    },
    wx: {
      showToast(options) {
        toastTitle = options.title
      }
    }
  })
  page.data.product = { id: 'product-1' }
  page.data.selectedTravelDate = '2026-06-19'
  page.data.travelers = [
    { name: '张三', phone: '12345', gender: 'male', idCard: '110105199001011234' }
  ]

  await page.submitOrder()

  assert.equal(createOrderCalls, 0)
  assert.match(toastTitle, /手机号/)
})

test('booking page submits direct order with all travelers and starts payment', async () => {
  let payload = null
  let payOrderId = ''
  const page = loadBookingPage({
    api: {
      async createDirectOrder(productId, travelDate, travelers) {
        payload = { productId, travelDate, travelers }
        return { order: { id: 'order-1', paymentStatus: 'unpaid' } }
      },
      async payOrder(id) {
        payOrderId = id
        return { order: { id, paymentStatus: 'paid' } }
      }
    }
  })
  page.data.product = { id: 'product-1' }
  page.data.selectedTravelDate = '2026-06-19'
  page.data.travelers = [
    { name: '张三', phone: '13800138000', gender: 'male', idCard: '110105199001011232' },
    { name: '李四', phone: '13900139000', gender: 'female', idCard: '110105199001011224' }
  ]

  await page.submitOrder()

  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    productId: 'product-1',
    travelDate: '2026-06-19',
    travelers: [
      { name: '张三', phone: '13800138000', gender: 'male', idCard: '110105199001011232' },
      { name: '李四', phone: '13900139000', gender: 'female', idCard: '110105199001011224' }
    ]
  })
  assert.equal(payOrderId, 'order-1')
})
