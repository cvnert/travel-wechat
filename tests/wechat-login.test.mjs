import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadApi({ apiBaseUrl = 'http://localhost:8080', requestImpl } = {}) {
  const filename = path.join(__dirname, '../utils/api.js')
  const code = fs.readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const capturedRequests = []
  const sandbox = {
    module,
    exports: module.exports,
    getApp() {
      return {
        globalData: {
          apiBaseUrl
        }
      }
    },
    wx: {
      getStorageSync() {
        return ''
      },
      request(options) {
        capturedRequests.push(options)
        if (requestImpl) {
          requestImpl(options)
        }
        options.success({
          statusCode: 200,
          data: {
            token: 'token-value',
            user: { id: 'user-id' },
            order: { id: 'order-1', status: 'paid' }
          }
        })
      }
    }
  }
  vm.runInNewContext(code, sandbox, { filename })
  return {
    api: module.exports,
    capturedRequests
  }
}

test('wechatLogin sends code and profile when profile is provided', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  const profile = {
    nickName: '微信用户',
    avatarUrl: 'https://example.com/avatar.png'
  }

  await loaded.api.wechatLogin('code-123', profile)

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/auth/wechat-login')
  assert.equal(capturedOptions.method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    code: 'code-123',
    profile
  })
})

test('wechatLogin sends only the login code when no profile is provided', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  await loaded.api.wechatLogin('code-123')

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/auth/wechat-login')
  assert.equal(capturedOptions.method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    code: 'code-123'
  })
})

test('updateWechatProfile sends authorized profile to the backend', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  const profile = {
    nickName: '旅人',
    avatarUrl: 'https://example.com/avatar.png',
    gender: 1,
    country: 'CN',
    province: 'Guangdong',
    city: 'Shenzhen',
    language: 'zh_CN'
  }

  await loaded.api.updateWechatProfile(profile)

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/auth/wechat-profile')
  assert.equal(capturedOptions.method, 'PUT')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    profile
  })
})

test('addCartItem posts product id and quantity to the cart endpoint', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  await loaded.api.addCartItem('product-1', 2)

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/cart/items')
  assert.equal(capturedOptions.method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    productId: 'product-1',
    quantity: 2
  })
})

test('createOrder submits selected cart item ids', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  await loaded.api.createOrder(['cart-1', 'cart-2'])

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/orders')
  assert.equal(capturedOptions.method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    cartItemIds: ['cart-1', 'cart-2']
  })
})

test('createDirectOrder submits product date and travelers', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  const travelers = [
    {
      name: '张三',
      phone: '13800138000',
      gender: 'male',
      idCard: '110105199001011232'
    },
    {
      name: '李四',
      phone: '13900139000',
      gender: 'female',
      idCard: '110105199001011224'
    }
  ]

  await loaded.api.createDirectOrder('product-1', '2026-06-19', travelers)

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/direct-orders')
  assert.equal(capturedOptions.method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    productId: 'product-1',
    travelDate: '2026-06-19',
    travelers
  })
})

test('payOrder posts to the order pay endpoint', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  await loaded.api.payOrder('order-1')

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/orders/order-1/pay')
  assert.equal(capturedOptions.method, 'POST')
})

test('uploadAvatar uploads the chosen image file with authorization', async () => {
  let capturedOptions = null
  const filename = path.join(__dirname, '../utils/api.js')
  const code = fs.readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    getApp() {
      return {
        globalData: {
          apiBaseUrl: 'http://localhost:8080'
        }
      }
    },
    wx: {
      getStorageSync(key) {
        return key === 'token' ? 'token-value' : ''
      },
      request() {
        throw new Error('request should not be used for avatar upload')
      },
      uploadFile(options) {
        capturedOptions = options
        options.success({
          statusCode: 200,
          data: JSON.stringify({
            user: { id: 'user-1', avatarUrl: 'https://example.com/avatar.png' }
          })
        })
      }
    }
  }

  vm.runInNewContext(code, sandbox, { filename })

  await module.exports.uploadAvatar('wxfile://avatar.png')

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/auth/avatar')
  assert.equal(capturedOptions.filePath, 'wxfile://avatar.png')
  assert.equal(capturedOptions.name, 'file')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.header)), {
    Authorization: 'Bearer token-value'
  })
})

test('mockPayOrder posts to the order mock-pay endpoint', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    requestImpl(options) {
      capturedOptions = options
    }
  })

  await loaded.api.mockPayOrder('order-1')

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'http://localhost:8080/api/orders/order-1/mock-pay')
  assert.equal(capturedOptions.method, 'POST')
})

test('request upgrades the production api base url to https', async () => {
  let capturedOptions = null
  const loaded = loadApi({
    apiBaseUrl: 'http://cvnert.com.cn:8080',
    requestImpl(options) {
      capturedOptions = options
    }
  })

  await loaded.api.getHomeContent()

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, 'https://cvnert.com.cn/api/home')
})

test('resolveMediaUrl prefixes relative upload paths with the normalized api base url', () => {
  const loaded = loadApi({
    apiBaseUrl: 'http://cvnert.com.cn:8080'
  })

  assert.equal(
    loaded.api.resolveMediaUrl('/uploads/avatars/a.png'),
    'https://cvnert.com.cn/uploads/avatars/a.png'
  )
})

test('resolveMediaUrl upgrades legacy upload origins to the normalized api base url', () => {
  const loaded = loadApi({
    apiBaseUrl: 'http://cvnert.com.cn:8080'
  })

  assert.equal(
    loaded.api.resolveMediaUrl('http://cvnert.com.cn:8080/uploads/avatars/a.png'),
    'https://cvnert.com.cn/uploads/avatars/a.png'
  )
})
