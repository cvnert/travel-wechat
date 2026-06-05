import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadCartPage({
  api = {},
  requireLogin = () => true,
  payment = {},
  wx = {}
} = {}) {
  const filename = path.join(__dirname, '../pages/cart/index.js')
  const code = fs.readFileSync(filename, 'utf8')
  let pageConfig = null
  const sandbox = {
    require(id) {
      const normalizedId = id.replace(/\.js$/, '')
      if (normalizedId === '../../utils/api') {
        return api
      }
      if (normalizedId === '../../utils/auth') {
        return { requireLogin }
      }
      if (normalizedId === '../../utils/format') {
        return {
          formatPrice(value) {
            const amount = Number(value || 0)
            return `楼${amount.toFixed(2)}`
          }
        }
      }
      if (normalizedId === '../../utils/payment') {
        return {
          async requestWechatPayment(paymentParams) {
            if (typeof payment.requestWechatPayment === 'function') {
              return payment.requestWechatPayment(paymentParams)
            }
          },
          async waitForPaidOrder(apiClient, orderId, options) {
            if (typeof payment.waitForPaidOrder === 'function') {
              return payment.waitForPaidOrder(apiClient, orderId, options)
            }
            return null
          },
          isPaymentCancelled(error) {
            if (typeof payment.isPaymentCancelled === 'function') {
              return payment.isPaymentCancelled(error)
            }
            return false
          },
          isOrderPaid(order) {
            if (typeof payment.isOrderPaid === 'function') {
              return payment.isOrderPaid(order)
            }
            return Boolean(order) && String(order.paymentStatus || '').toLowerCase() === 'paid'
          }
        }
      }
      throw new Error(`unexpected require: ${id}`)
    },
    Page(config) {
      pageConfig = config
    },
    wx: {
      showToast() {},
      showModal() {},
      navigateTo() {},
      switchTab() {},
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

test('loadCart selects all cart items by default and computes selected total', async () => {
  const page = loadCartPage({
    api: {
      async getCart() {
        return {
          totalQuantity: 3,
          totalAmount: 1798,
          cartItems: [
            {
              id: 'cart-1',
              quantity: 1,
              subtotalAmount: 998,
              travelDate: '2026-06-19',
              product: { price: 998 }
            },
            {
              id: 'cart-2',
              quantity: 2,
              subtotalAmount: 800,
              travelDate: '2026-06-19',
              product: { price: 400 }
            }
          ]
        }
      }
    }
  })

  await page.loadCart()

  assert.deepEqual(JSON.parse(JSON.stringify(page.data.selectedIds)), ['cart-1', 'cart-2'])
  assert.equal(page.data.selectedQuantity, 3)
  assert.equal(page.data.selectedAmountText, '楼1798.00')
  assert.equal(page.data.recommendSingle, false)
})

test('checkout submits selected cart item ids and starts wechat payment', async () => {
  let submittedIds = null
  let submittedTravelDate = ''
  let payOrderId = ''
  let requestedPaymentParams = null
  let waitedOrderId = ''
  let loadCartCalls = 0
  const page = loadCartPage({
    api: {
      async createOrder(cartItemIds, travelDate) {
        submittedIds = cartItemIds
        submittedTravelDate = travelDate
        return { order: { id: 'order-1' } }
      },
      async payOrder(id) {
        payOrderId = id
        return {
          order: { id: 'order-1', paymentStatus: 'unpaid' },
          paymentParams: {
            timeStamp: '1',
            nonceStr: 'nonce',
            package: 'prepay_id=123',
            signType: 'RSA',
            paySign: 'sign'
          }
        }
      }
    },
    payment: {
      async requestWechatPayment(paymentParams) {
        requestedPaymentParams = paymentParams
      },
      async waitForPaidOrder(_, orderId) {
        waitedOrderId = orderId
        return { id: orderId, paymentStatus: 'paid' }
      }
    }
  })

  page.data.cartItems = [
    { id: 'cart-1', quantity: 1, subtotalAmount: 998, selected: true, travelDate: '2026-06-19', product: { priceText: '楼998.00' } },
    { id: 'cart-2', quantity: 1, subtotalAmount: 500, selected: false, travelDate: '2026-06-19', product: { priceText: '楼500.00' } }
  ]
  page.data.selectedIds = ['cart-1']
  page.loadCart = async () => {
    loadCartCalls += 1
  }

  await page.checkout()

  assert.deepEqual(JSON.parse(JSON.stringify(submittedIds)), ['cart-1'])
  assert.equal(submittedTravelDate, '2026-06-19')
  assert.equal(payOrderId, 'order-1')
  assert.deepEqual(JSON.parse(JSON.stringify(requestedPaymentParams)), {
    timeStamp: '1',
    nonceStr: 'nonce',
    package: 'prepay_id=123',
    signType: 'RSA',
    paySign: 'sign'
  })
  assert.equal(waitedOrderId, 'order-1')
  assert.equal(loadCartCalls, 1)
})
