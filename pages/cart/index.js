const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')
const {
  requestWechatPayment,
  waitForPaidOrder,
  isPaymentCancelled,
  isOrderPaid
} = require('../../utils/payment.js')

function normalizeCartItems(list) {
  return (list || []).map((item) => {
    const product = item.product || {}
    const quantity = Number(item.quantity || 0)
    const subtotalAmount = Number(
      item.subtotalAmount != null
        ? item.subtotalAmount
        : quantity * Number(product.price || 0)
    )

    return {
      ...item,
      quantity,
      subtotalAmount,
      quantityText: `x${quantity}`,
      travelDateText: item.travelDate ? `出发 ${item.travelDate}` : '',
      product: {
        ...product,
        priceText: formatPrice(product.price),
        coverDisplayUrl: product.coverImageUrl || product.coverImage || '',
        badgeText: product.tag || '旅行线路',
        summaryText: product.shortDescription || product.summary || '出行信息可在下单后查看',
        bookingText: '定金预订',
        serviceText: product.tag || '官方精选',
        guaranteeText: '放心购· 平台客服全程协助',
        priceCaption: '预订价'
      }
    }
  })
}

function normalizeRecommendProducts(list) {
  return (list || []).map((item) => {
    const cover = item.coverImageUrl || item.coverImage
    const banner = item.bannerImageUrls && item.bannerImageUrls.length
      ? item.bannerImageUrls[0]
      : ''

    return {
      ...item,
      priceText: formatPrice(item.price),
      coverDisplayUrl: cover || banner || ''
    }
  })
}

function buildSelectionState(cartItems, selectedIds) {
  const nextSelectedIds = Array.isArray(selectedIds)
    ? selectedIds.filter((id) => cartItems.some((item) => item.id === id))
    : cartItems.map((item) => item.id)
  const selectedSet = new Set(nextSelectedIds)

  let selectedQuantity = 0
  let selectedAmount = 0

  const nextCartItems = cartItems.map((item) => {
    const selected = selectedSet.has(item.id)
    if (selected) {
      selectedQuantity += item.quantity
      selectedAmount += item.subtotalAmount
    }

    return {
      ...item,
      selected,
      checkClass: selected ? 'cart-check cart-check-active' : 'cart-check',
      showCheckDot: selected
    }
  })

  const allSelected = nextCartItems.length > 0 && nextSelectedIds.length === nextCartItems.length

  return {
    cartItems: nextCartItems,
    selectedIds: nextSelectedIds,
    selectedQuantity,
    selectedAmountText: formatPrice(selectedAmount),
    allSelected,
    allSelectedCheckClass: allSelected ? 'cart-check cart-check-active' : 'cart-check',
    showAllSelectedDot: allSelected,
    checkoutDisabled: nextSelectedIds.length === 0
  }
}

function buildCartViewState(state) {
  const cartItems = state.cartItems || []
  const recommendProducts = state.recommendProducts || []

  return {
    showLoadingState: Boolean(state.loading) && cartItems.length === 0,
    showEmptyState: !state.loading && cartItems.length === 0,
    showCartList: cartItems.length > 0,
    showRecommendations: recommendProducts.length > 0,
    showCheckoutBar: cartItems.length > 0,
    recommendGridClass: state.recommendSingle ? 'recommend-grid recommend-grid-single' : 'recommend-grid'
  }
}

Page({
  data: {
    cartItems: [],
    totalQuantity: 0,
    totalAmountText: formatPrice(0),
    selectedIds: null,
    selectedQuantity: 0,
    selectedAmountText: formatPrice(0),
    allSelected: false,
    allSelectedCheckClass: 'cart-check',
    showAllSelectedDot: false,
    checkoutDisabled: true,
    recommendProducts: [],
    recommendSingle: false,
    recommendGridClass: 'recommend-grid',
    loading: false,
    paying: false,
    showLoadingState: false,
    showEmptyState: false,
    showCartList: false,
    showRecommendations: false,
    showCheckoutBar: false
  },

  onShow() {
    this.loadCart()
    this.loadRecommendations()
  },

  setCartState(partial) {
    const nextState = {
      ...this.data,
      ...partial
    }

    this.setData({
      ...partial,
      ...buildCartViewState(nextState)
    })
  },

  async loadCart() {
    if (!requireLogin('登录后可查看购物车')) {
      this.setCartState({
        cartItems: [],
        totalQuantity: 0,
        totalAmountText: formatPrice(0),
        selectedIds: [],
        selectedQuantity: 0,
        selectedAmountText: formatPrice(0),
        allSelected: false,
        allSelectedCheckClass: 'cart-check',
        showAllSelectedDot: false,
        checkoutDisabled: true,
        loading: false
      })
      return
    }

    this.setCartState({ loading: true })
    try {
      const result = await api.getCart()
      const cartItems = normalizeCartItems(result.cartItems || [])
      this.setCartState({
        loading: false,
        totalQuantity: Number(result.totalQuantity || 0),
        totalAmountText: formatPrice(result.totalAmount || 0),
        ...buildSelectionState(cartItems, this.data.selectedIds)
      })
    } catch (error) {
      wx.showToast({ title: error.error || '加载购物车失败', icon: 'none' })
    } finally {
      if (this.data.loading) {
        this.setCartState({ loading: false })
      }
    }
  },

  async loadRecommendations() {
    try {
      const result = await api.getProducts(1, 4)
      const recommendProducts = normalizeRecommendProducts(result.productList || [])
      this.setCartState({
        recommendProducts,
        recommendSingle: recommendProducts.length === 1
      })
    } catch (error) {
      void error
    }
  },

  syncSelection(selectedIds) {
    this.setCartState(buildSelectionState(this.data.cartItems, selectedIds))
  },

  toggleSelect(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }

    const selectedIds = Array.isArray(this.data.selectedIds) ? this.data.selectedIds.slice() : []
    const index = selectedIds.indexOf(id)
    if (index >= 0) {
      selectedIds.splice(index, 1)
    } else {
      selectedIds.push(id)
    }

    this.syncSelection(selectedIds)
  },

  toggleSelectAll() {
    if (this.data.allSelected) {
      this.syncSelection([])
      return
    }

    this.syncSelection(this.data.cartItems.map((item) => item.id))
  },

  async changeQuantity(event) {
    const { id, delta } = event.currentTarget.dataset
    const item = this.data.cartItems.find((current) => current.id === id)
    if (!item) {
      return
    }

    const nextQuantity = Number(item.quantity) + Number(delta || 0)
    if (nextQuantity < 1) {
      return
    }

    try {
      await api.updateCartItem(id, nextQuantity)
      await this.loadCart()
    } catch (error) {
      wx.showToast({ title: error.error || '更新数量失败', icon: 'none' })
    }
  },

  async removeItem(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }

    try {
      await api.deleteCartItem(id)
      wx.showToast({ title: '已移出购物车', icon: 'success' })
      await this.loadCart()
    } catch (error) {
      wx.showToast({ title: error.error || '删除失败', icon: 'none' })
    }
  },

  async checkout() {
    if (!requireLogin('登录后可提交订单')) {
      return
    }

    const selectedIds = Array.isArray(this.data.selectedIds) ? this.data.selectedIds : []
    if (selectedIds.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    const selectedItems = this.data.cartItems.filter((item) => selectedIds.includes(item.id))
    const travelDates = Array.from(new Set(selectedItems.map((item) => item.travelDate).filter(Boolean)))
    if (travelDates.length !== 1) {
      wx.showToast({ title: '请选择同一天出发的商品', icon: 'none' })
      return
    }
    if (this.data.paying) {
      return
    }

    this.setData({ paying: true })
    var createdOrder = null
    try {
      const createResult = await api.createOrder(selectedIds, travelDates[0])
      createdOrder = createResult.order || null
      const payResult = await api.payOrder(createdOrder.id)
      const currentOrder = payResult.order || createdOrder

      if (!isOrderPaid(currentOrder)) {
        if (!payResult.paymentParams) {
          throw { error: '未获取到微信支付参数' }
        }
        await requestWechatPayment(payResult.paymentParams)
      }

      const paidOrder = isOrderPaid(currentOrder)
        ? currentOrder
        : await waitForPaidOrder(api, currentOrder.id)

      await this.loadCart()

      if (!isOrderPaid(paidOrder)) {
        wx.showModal({
          title: '支付结果确认中',
          content: '订单已创建，支付结果正在同步，请稍后到订单详情查看。',
          confirmText: '查看订单',
          showCancel: false,
          success: () => {
            wx.navigateTo({ url: `/pages/order-detail/index?id=${currentOrder.id}` })
          }
        })
        return
      }

      wx.showModal({
        title: '支付成功',
        content: '订单已创建，出行凭证已生成，可在订单详情中查看并出示核销。',
        confirmText: '查看凭证',
        cancelText: '稍后再看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/order-detail/index?id=${paidOrder.id}` })
            return
          }
          wx.navigateTo({ url: '/pages/orders/index?status=pending_travel' })
        }
      })
    } catch (error) {
      if (isPaymentCancelled(error)) {
        if (createdOrder && createdOrder.id) {
          await this.loadCart()
          wx.showModal({
            title: '已取消支付',
            content: '订单已保留在待支付列表中，可以稍后继续支付。',
            confirmText: '查看订单',
            cancelText: '继续逛逛',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({ url: `/pages/order-detail/index?id=${createdOrder.id}` })
              }
            }
          })
          return
        }
        wx.showToast({ title: '已取消支付', icon: 'none' })
        return
      }
      wx.showToast({ title: error.error || '下单失败', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  goDetail(event) {
    const { id } = event.currentTarget.dataset
    if (!id) {
      return
    }
    wx.navigateTo({ url: `/pages/product-detail/index?id=${id}` })
  }
})
