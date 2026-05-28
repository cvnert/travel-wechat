const app = getApp()

function getApiBaseUrl() {
  return app.globalData.apiBaseUrl || 'http://101.35.131.94:8080'
}

module.exports = {
  getApiBaseUrl
}
