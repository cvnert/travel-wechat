const app = getApp()

function getApiBaseUrl() {
  return app.globalData.apiBaseUrl || 'http://cvnert.com.cn:8080'
}

module.exports = {
  getApiBaseUrl
}
