var DEFAULT_API_BASE_URL = 'https://cvnert.com.cn'

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function parseHttpUrl(value) {
  var match = /^(https?):\/\/([^/]+)(\/.*)?$/i.exec(String(value || '').trim())
  if (!match) {
    return null
  }
  return {
    protocol: match[1].toLowerCase(),
    host: match[2].toLowerCase(),
    path: match[3] || ''
  }
}

function stripPort(host) {
  return String(host || '').replace(/:\d+$/, '')
}

function normalizeApiBaseUrl(value) {
  var trimmed = trimTrailingSlash(String(value || '').trim())
  if (!trimmed) {
    return DEFAULT_API_BASE_URL
  }

  var configured = parseHttpUrl(trimmed)
  var fallback = parseHttpUrl(DEFAULT_API_BASE_URL)
  if (
    configured &&
    fallback &&
    configured.protocol === 'http' &&
    stripPort(configured.host) === stripPort(fallback.host)
  ) {
    return DEFAULT_API_BASE_URL
  }

  return trimmed
}

function getApiBaseUrl() {
  var app = typeof getApp === 'function' ? getApp() : null
  var apiBaseUrl = app && app.globalData ? app.globalData.apiBaseUrl : ''
  return normalizeApiBaseUrl(apiBaseUrl || DEFAULT_API_BASE_URL)
}

function resolveMediaUrl(value) {
  var trimmed = String(value || '').trim()
  if (!trimmed) {
    return ''
  }

  if (/^\/\//.test(trimmed)) {
    return 'https:' + trimmed
  }

  if (/^https?:\/\//i.test(trimmed)) {
    var source = parseHttpUrl(trimmed)
    var base = parseHttpUrl(getApiBaseUrl())
    if (source && base && stripPort(source.host) === stripPort(base.host)) {
      return base.protocol + '://' + base.host + source.path
    }
    return trimmed
  }

  if (trimmed.charAt(0) === '/') {
    return getApiBaseUrl() + trimmed
  }

  return trimmed
}

function cloneHeaders(headers) {
  var result = {}
  var source = headers || {}
  for (var key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key]
    }
  }
  return result
}

function request(options) {
  var requestOptions = options || {}
  var token = wx.getStorageSync('token')
  var headers = cloneHeaders(requestOptions.header)
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  return new Promise(function(resolve, reject) {
    wx.request({
      url: getApiBaseUrl() + requestOptions.url,
      method: requestOptions.method || 'GET',
      data: requestOptions.data || {},
      header: headers,
      success: function(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject(res.data || { error: '请求失败' })
      },
      fail: function(err) {
        reject(err)
      }
    })
  })
}

function login(username, password) {
  return request({
    url: '/api/auth/login',
    method: 'POST',
    data: { username: username, password: password }
  })
}

function register(username, password, nickname) {
  return request({
    url: '/api/auth/register',
    method: 'POST',
    data: { username: username, password: password, nickname: nickname }
  })
}

function wechatLogin(code, profile) {
  var payload = { code: code }
  if (profile) {
    payload.profile = profile
  }
  return request({
    url: '/api/auth/wechat-login',
    method: 'POST',
    data: payload
  })
}

function updateWechatProfile(profile) {
  return request({
    url: '/api/auth/wechat-profile',
    method: 'PUT',
    data: { profile: profile }
  })
}

function uploadAvatar(filePath) {
  var token = wx.getStorageSync('token')
  var headers = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  return new Promise(function(resolve, reject) {
    wx.uploadFile({
      url: getApiBaseUrl() + '/api/auth/avatar',
      filePath: filePath,
      name: 'file',
      header: headers,
      success: function(res) {
        var responseData = res.data
        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData)
          } catch (error) {
            reject({ error: '头像上传失败' })
            return
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData)
          return
        }

        reject(responseData || { error: '头像上传失败' })
      },
      fail: function(err) {
        reject(err)
      }
    })
  })
}

function getProducts(page, pageSize) {
  return request({
    url: '/api/products',
    data: {
      page: page == null ? 1 : page,
      pageSize: pageSize == null ? 20 : pageSize
    }
  })
}

function getHomeContent() {
  return request({
    url: '/api/home'
  })
}

function getProductDetail(id) {
  return request({
    url: '/api/products/' + id
  })
}

function getCart() {
  return request({
    url: '/api/cart'
  })
}

function addCartItem(productId, quantity, travelDate) {
  const data = {
    productId: productId,
    quantity: quantity == null ? 1 : quantity
  }
  if (travelDate) {
    data.travelDate = travelDate
  }
  return request({
    url: '/api/cart/items',
    method: 'POST',
    data: data
  })
}

function updateCartItem(id, quantity) {
  return request({
    url: '/api/cart/items/' + id,
    method: 'PATCH',
    data: { quantity: quantity }
  })
}

function deleteCartItem(id) {
  return request({
    url: '/api/cart/items/' + id,
    method: 'DELETE'
  })
}

function createOrder(cartItemIds, travelDate) {
  const data = {
    cartItemIds: cartItemIds || []
  }
  if (travelDate) {
    data.travelDate = travelDate
  }
  return request({
    url: '/api/orders',
    method: 'POST',
    data: data
  })
}

function listOrders(status, page, pageSize) {
  return request({
    url: '/api/orders',
    data: {
      status: status || '',
      page: page == null ? 1 : page,
      pageSize: pageSize == null ? 20 : pageSize
    }
  })
}

function getOrder(id) {
  return request({
    url: '/api/orders/' + id
  })
}

function payOrder(id) {
  return request({
    url: '/api/orders/' + id + '/pay',
    method: 'POST'
  })
}

function mockPayOrder(id) {
  return request({
    url: '/api/orders/' + id + '/mock-pay',
    method: 'POST'
  })
}

module.exports = {
  login: login,
  register: register,
  wechatLogin: wechatLogin,
  updateWechatProfile: updateWechatProfile,
  uploadAvatar: uploadAvatar,
  resolveMediaUrl: resolveMediaUrl,
  getHomeContent: getHomeContent,
  getProducts: getProducts,
  getProductDetail: getProductDetail,
  getCart: getCart,
  addCartItem: addCartItem,
  updateCartItem: updateCartItem,
  deleteCartItem: deleteCartItem,
  createOrder: createOrder,
  listOrders: listOrders,
  getOrder: getOrder,
  payOrder: payOrder,
  mockPayOrder: mockPayOrder
}
