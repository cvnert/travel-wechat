const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')
const {
  normalizeOrderStatus,
  orderStatusText,
  orderStatusTone,
  shouldShowVoucher
} = require('../../utils/order.js')
const {
  requestWechatPayment,
  waitForPaidOrder,
  isPaymentCancelled,
  isOrderPaid
} = require('../../utils/payment.js')

function formatTime(value) {
  if (!value) {
    return ''
  }
  return String(value).replace('T', ' ').slice(0, 19)
}

function normalizeOrder(order) {
  const status = normalizeOrderStatus(order.status)
  const paidAtText = formatTime(order.paidAt)
  const createdAtText = formatTime(order.createdAt)
  const verifiedAtText = formatTime(order.verifiedAt)

  return {
    ...order,
    status,
    statusText: orderStatusText(status),
    statusTone: orderStatusTone(status),
    canShowVoucher: shouldShowVoucher(status),
    totalAmountText: formatPrice(order.totalAmount),
    createdAtText,
    paidAtText,
    verifiedAtText,
    paidOrCreatedText: paidAtText || createdAtText,
    showVerifiedAt: Boolean(verifiedAtText),
    showPendingPayment: status === 'pending_payment',
    voucherHintText: status === 'completed'
      ? '该凭证已完成核销，可作为本次出行记录留存。'
      : '出行当天请向工作人员出示该凭证码进行核销。',
    items: (order.items || []).map((item) => ({
      ...item,
      coverDisplayUrl: item.productCoverImageUrl || item.productCoverImage || '',
      unitPriceText: formatPrice(item.unitPrice),
      subtotalText: formatPrice(item.subtotalAmount),
      travelers: (item.travelers || []).map((traveler, index) => ({
        ...traveler,
        title: `出行人 ${index + 1}`,
        genderText: traveler.gender === 'female' ? '女' : '男'
      })),
      showTravelers: (item.travelers || []).length > 0
    }))
  }
}

function buildOrderDetailViewState(loading, order) {
  return {
    showLoadingState: loading && !order,
    showMissingState: !loading && !order,
    showContent: Boolean(order),
    showVoucherCard: Boolean(order && order.canShowVoucher),
    showPendingPaymentBar: Boolean(order && order.showPendingPayment)
  }
}

Page({
  data: {
    orderId: '',
    order: null,
    loading: false,
    paying: false,
    showLoadingState: false,
    showMissingState: false,
    showContent: false,
    showVoucherCard: false,
    showPendingPaymentBar: false
  },

  setDetailState(partial) {
    const nextState = {
      ...this.data,
      ...partial
    }

    this.setData({
      ...partial,
      ...buildOrderDetailViewState(nextState.loading, nextState.order)
    })
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '缺少订单 ID', icon: 'none' })
      return
    }

    this.setData({ orderId: options.id })
    this.loadOrder()
  },

  async loadOrder() {
    if (!requireLogin('登录后可查看订单详情')) {
      return
    }

    this.setDetailState({ loading: true })
    try {
      const result = await api.getOrder(this.data.orderId)
      this.setDetailState({
        loading: false,
        order: normalizeOrder(result.order)
      })
    } catch (error) {
      wx.showToast({ title: error.error || '加载订单详情失败', icon: 'none' })
    } finally {
      if (this.data.loading) {
        this.setDetailState({ loading: false })
      }
    }
  },

  async payOrder() {
    if (!this.data.orderId || this.data.paying) {
      return
    }

    this.setData({ paying: true })
    try {
      const payResult = await api.payOrder(this.data.orderId)
      const currentOrder = payResult.order || { id: this.data.orderId }

      if (!isOrderPaid(currentOrder)) {
        if (!payResult.paymentParams) {
          throw { error: '未获取到微信支付参数' }
        }
        await requestWechatPayment(payResult.paymentParams)
      }

      const paidOrder = isOrderPaid(currentOrder)
        ? currentOrder
        : await waitForPaidOrder(api, this.data.orderId)

      await this.loadOrder()

      if (!isOrderPaid(paidOrder)) {
        wx.showToast({ title: '支付结果确认中，请稍后刷新订单', icon: 'none' })
        return
      }

      wx.showToast({ title: '支付成功，凭证已生成', icon: 'success' })
    } catch (error) {
      if (isPaymentCancelled(error)) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
        return
      }
      wx.showToast({ title: error.error || '支付失败', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  },

  copyVerificationCode() {
    const order = this.data.order
    if (!order || !order.verificationCode) {
      return
    }

    wx.setClipboardData({
      data: order.verificationCode
    })
  }
})
