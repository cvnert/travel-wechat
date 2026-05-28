export function formatPrice(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return '￥0.00'
  }
  return `￥${numberValue.toFixed(2)}`
}

export function normalizeImageUrl(url, apiBaseUrl) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${String(apiBaseUrl).replace(/\/$/, '')}${url}`
}
