var DEFAULT_API_BASE_URL = 'https://cvnert.com.cn'

function getApiBaseUrl() {
  var app = typeof getApp === 'function' ? getApp() : null
  var apiBaseUrl = app && app.globalData ? app.globalData.apiBaseUrl : ''
  return apiBaseUrl || DEFAULT_API_BASE_URL
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

function wechatLogin(code) {
  return request({
    url: '/api/auth/wechat-login',
    method: 'POST',
    data: { code: code }
  })
}

function updateWechatProfile(profile) {
  return request({
    url: '/api/auth/wechat-profile',
    method: 'PUT',
    data: { profile: profile }
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

function addCartItem(productId, quantity) {
  return request({
    url: '/api/cart/items',
    method: 'POST',
    data: {
      productId: productId,
      quantity: quantity == null ? 1 : quantity
    }
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

function createOrder(cartItemIds) {
  return request({
    url: '/api/orders',
    method: 'POST',
    data: { cartItemIds: cartItemIds || [] }
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
