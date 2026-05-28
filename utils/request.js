const { getApiBaseUrl } = require('./config')

function request(options) {
  const token = wx.getStorageSync('token')
  const headers = Object.assign({}, options.header || {})
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getApiBaseUrl()}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: headers,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject(res.data || { error: '请求失败' })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  request
}
