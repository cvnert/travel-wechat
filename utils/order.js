const ORDER_STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'pending_travel', label: '待出行' },
  { key: 'completed', label: '已出行' }
]

function normalizeOrderStatus(status) {
  if (status === 'paid') {
    return 'pending_travel'
  }
  return status || ''
}

function orderStatusText(status) {
  switch (normalizeOrderStatus(status)) {
    case 'pending_payment':
      return '待支付'
    case 'pending_travel':
      return '待出行'
    case 'completed':
      return '已出行'
    default:
      return '订单处理中'
  }
}

function orderStatusTone(status) {
  switch (normalizeOrderStatus(status)) {
    case 'pending_payment':
      return 'warning'
    case 'pending_travel':
      return 'primary'
    case 'completed':
      return 'success'
    default:
      return 'warning'
  }
}

function shouldShowVoucher(status) {
  const normalized = normalizeOrderStatus(status)
  return normalized === 'pending_travel' || normalized === 'completed'
}

module.exports = {
  ORDER_STATUS_TABS,
  normalizeOrderStatus,
  orderStatusText,
  orderStatusTone,
  shouldShowVoucher
}
