function getApiBaseUrl() {
  const app = typeof getApp === 'function' ? getApp() : null
  const apiBaseUrl = app && app.globalData ? app.globalData.apiBaseUrl : ''
  return apiBaseUrl || 'https://cvnert.com.cn'
}

module.exports = {
  getApiBaseUrl
}
