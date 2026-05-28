const { request } = require('./request')

function login(username, password) {
  return request({
    url: '/api/auth/login',
    method: 'POST',
    data: { username, password }
  })
}

function register(username, password, nickname) {
  return request({
    url: '/api/auth/register',
    method: 'POST',
    data: { username, password, nickname }
  })
}

function wechatLogin(code) {
  return request({
    url: '/api/auth/wechat-login',
    method: 'POST',
    data: { code }
  })
}

function updateWechatProfile(profile) {
  return request({
    url: '/api/auth/wechat-profile',
    method: 'PUT',
    data: { profile }
  })
}

function getProducts(page = 1, pageSize = 20) {
  return request({
    url: '/api/products',
    data: { page, pageSize }
  })
}

function getHomeContent() {
  return request({
    url: '/api/home'
  })
}

function getProductDetail(id) {
  return request({
    url: `/api/products/${id}`
  })
}

module.exports = {
  login,
  register,
  wechatLogin,
  updateWechatProfile,
  getHomeContent,
  getProducts,
  getProductDetail
}
