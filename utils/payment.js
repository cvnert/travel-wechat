function requestWechatPayment(paymentParams) {
  return new Promise(function(resolve, reject) {
    wx.requestPayment({
      timeStamp: paymentParams.timeStamp,
      nonceStr: paymentParams.nonceStr,
      package: paymentParams.package,
      signType: paymentParams.signType || 'RSA',
      paySign: paymentParams.paySign,
      success: function(result) {
        resolve(result)
      },
      fail: function(error) {
        reject(error)
      }
    })
  })
}

function sleep(duration) {
  return new Promise(function(resolve) {
    setTimeout(resolve, duration)
  })
}

function isOrderPaid(order) {
  return Boolean(order) && String(order.paymentStatus || '').toLowerCase() === 'paid'
}

function isPaymentCancelled(error) {
  var message = error && error.errMsg ? String(error.errMsg) : ''
  return message.indexOf('requestPayment:fail cancel') >= 0
}

async function waitForPaidOrder(api, orderId, options) {
  var attempts = options && options.attempts ? Number(options.attempts) : 5
  var interval = options && options.interval ? Number(options.interval) : 1200

  for (var index = 0; index < attempts; index += 1) {
    var result = await api.getOrder(orderId)
    if (isOrderPaid(result.order)) {
      return result.order
    }

    if (index < attempts - 1) {
      await sleep(interval)
    }
  }

  return null
}

module.exports = {
  requestWechatPayment: requestWechatPayment,
  waitForPaidOrder: waitForPaidOrder,
  isPaymentCancelled: isPaymentCancelled,
  isOrderPaid: isOrderPaid
}
