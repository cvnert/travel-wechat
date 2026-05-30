var DEFAULT_API_BASE_URL = 'https://cvnert.com.cn'

function getApiBaseUrl() {
  var app = typeof getApp === 'function' ? getApp() : null
  var apiBaseUrl = app && app.globalData ? app.globalData.apiBaseUrl : ''
  return apiBaseUrl || DEFAULT_API_BASE_URL
}

function formatPrice(value) {
  var numberValue = Number(value)
  if (!isFinite(numberValue)) {
    return '\u00A5' + '0.00'
  }
  return '\u00A5' + numberValue.toFixed(2)
}

function normalizeImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return getApiBaseUrl().replace(/\/$/, '') + url
}

module.exports = {
  formatPrice: formatPrice,
  normalizeImageUrl: normalizeImageUrl
}
