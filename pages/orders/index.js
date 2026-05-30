const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')
const {
  ORDER_STATUS_TABS,
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

function buildStatusTabs(activeStatus) {
  return ORDER_STATUS_TABS.map((item) => ({
    ...item,
    tabClass: item.key === activeStatus ? 'tab tab-active' : 'tab'
  }))
}

function decorateOrders(orders, payingOrderId) {
  return (orders || []).map((order) => ({
    ...order,
    isPaying: order.id === payingOrderId
  }))
}

function normalizeOrders(result) {
  return (result.orderList || []).map((order) => {
    const status = normalizeOrderStatus(order.status)
    return {
      ...order,
      status,
      statusText: orderStatusText(status),
      statusTone: orderStatusTone(status),
      canShowVoucher: shouldShowVoucher(status),
      showPayAction: status === 'pending_payment',
      actionLabel: shouldShowVoucher(status) ? '查看凭证' : '查看订单',
      totalAmountText: formatPrice(order.totalAmount),
      items: (order.items || []).map((item) => ({
        ...item,
        coverDisplayUrl: item.productCoverImageUrl || item.productCoverImage || '',
        unitPriceText: formatPrice(item.unitPrice),
        subtotalText: formatPrice(item.subtotalAmount)
      }))
    }
  })
}

function buildOrdersViewState(loading, orders) {
  return {
    showLoadingState: loading && orders.length === 0,
    showEmptyState: !loading && orders.length === 0
  }
}

Page({
  data: {
    statusTabs: buildStatusTabs(''),
    activeStatus: '',
    orders: [],
    loading: false,
    payingOrderId: '',
    showLoadingState: false,
    showEmptyState: false
  },

  setOrdersState(partial) {
    const nextState = {
      ...this.data,
      ...partial
    }

    this.setData({
      ...partial,
      statusTabs: buildStatusTabs(nextState.activeStatus),
      orders: decorateOrders(nextState.orders, nextState.payingOrderId),
      ...buildOrdersViewState(nextState.loading, nextState.orders)
    })
  },

  onLoad(options) {
    const nextStatus = options && options.status ? normalizeOrderStatus(options.status) : ''
    this.setOrdersState({
      activeStatus: ORDER_STATUS_TABS.some((item) => item.key === nextStatus) ? nextStatus : ''
    })
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    if (!requireLogin('登录后可查看订单')) {
      return
    }

    this.setOrdersState({ loading: true })
    try {
      const result = await api.listOrders(this.data.activeStatus)
      this.setOrdersState({
        loading: false,
        orders: normalizeOrders(result)
      })
    } catch (error) {
      wx.showToast({ title: error.error || '加载订单失败', icon: 'none' })
    } finally {
      if (this.data.loading) {
        this.setOrdersState({ loading: false })
      }
    }
  },

  switchStatus(event) {
    const nextStatus = normalizeOrderStatus(event.currentTarget.dataset.status || '')
    if (nextStatus === this.data.activeStatus) {
      return
    }
    this.setOrdersState({ activeStatus: nextStatus })
    this.loadOrders()
  },

  openOrderDetail(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }
    wx.navigateTo({ url: `/pages/order-detail/index?id=${id}` })
  },

  async payOrder(event) {
    const { id } = event.currentTarget.dataset
    if (!id || this.data.payingOrderId) {
      return
    }

    this.setOrdersState({ payingOrderId: id })
    try {
      const result = await api.payOrder(id)
      const currentOrder = result.order || { id }

      if (!isOrderPaid(currentOrder)) {
        if (!result.paymentParams) {
          throw { error: '未获取到微信支付参数' }
        }
        await requestWechatPayment(result.paymentParams)
      }

      const paidOrder = isOrderPaid(currentOrder)
        ? currentOrder
        : await waitForPaidOrder(api, id)

      await this.loadOrders()

      if (!isOrderPaid(paidOrder)) {
        wx.showToast({ title: '支付结果确认中，请稍后刷新订单', icon: 'none' })
        return
      }

      wx.showModal({
        title: '支付成功',
        content: '出行凭证已生成，核销时出示订单详情里的凭证码即可。',
        confirmText: '查看凭证',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/order-detail/index?id=${paidOrder.id}` })
          }
        }
      })
    } catch (error) {
      if (isPaymentCancelled(error)) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
        return
      }
      wx.showToast({ title: error.error || '支付失败', icon: 'none' })
    } finally {
      this.setOrdersState({ payingOrderId: '' })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
