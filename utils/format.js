const { getApiBaseUrl } = require('./config')

function formatPrice(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return '￥0.00'
  }
  return `￥${numberValue.toFixed(2)}`
}

function normalizeImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${getApiBaseUrl().replace(/\/$/, '')}${url}`
}

module.exports = {
  formatPrice,
  normalizeImageUrl
}
