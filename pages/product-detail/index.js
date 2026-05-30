const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')

Page({
  data: {
    product: null,
    images: [],
    detailImages: [],
    actionLoading: false,
    cartCount: 0,
    cartBadgeText: ''
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '缺少产品 ID', icon: 'none' })
      return
    }
    this.loadDetail(options.id)
  },

  onShow() {
    this.refreshCartCount()
  },

  async loadDetail(id) {
    wx.showLoading({ title: '加载中' })
    try {
      const result = await api.getProductDetail(id)
      const summaryText = result.productDetail.summary || result.productDetail.shortDescription || ''
      const product = {
        ...result.productDetail,
        priceText: formatPrice(result.productDetail.price),
        summaryText,
        hasSummary: Boolean(summaryText)
      }
      const images = product.bannerImageUrls && product.bannerImageUrls.length
        ? product.bannerImageUrls
        : [product.coverImageUrl || product.coverImage]
      const detailImages = product.detailImageUrls && product.detailImageUrls.length
        ? product.detailImageUrls
        : product.detailImages || []

      this.setData({
        product,
        images: images.filter(Boolean),
        detailImages: detailImages.filter(Boolean)
      })
      wx.setNavigationBarTitle({ title: product.title || '产品详情' })
    } catch (error) {
      wx.showToast({ title: error.error || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async refreshCartCount() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ cartCount: 0, cartBadgeText: '' })
      return
    }

    try {
      const result = await api.getCart()
      const cartCount = Number(result.totalQuantity || 0)
      this.setData({
        cartCount,
        cartBadgeText: cartCount > 99 ? '99+' : String(cartCount)
      })
    } catch (error) {
      void error
      this.setData({ cartCount: 0, cartBadgeText: '' })
    }
  },

  callService() {
    const phone = this.data.product && this.data.product.customerServicePhone
    if (!phone) {
      wx.showToast({ title: '暂无客服电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: phone })
  },

  openCart() {
    if (!requireLogin('登录后可查看购物车')) {
      return
    }
    wx.switchTab({ url: '/pages/cart/index' })
  },

  async addToCart() {
    if (!requireLogin('登录后可将产品加入购物车')) {
      return
    }
    if (!this.data.product || this.data.actionLoading) {
      return
    }

    this.setData({ actionLoading: true })
    try {
      await api.addCartItem(this.data.product.id, 1)
      await this.refreshCartCount()
      wx.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.error || '加入购物车失败', icon: 'none' })
    } finally {
      this.setData({ actionLoading: false })
    }
  },

  async reserve() {
    if (!requireLogin('登录后可立即购买')) {
      return
    }
    if (!this.data.product || this.data.actionLoading) {
      return
    }

    this.setData({ actionLoading: true })
    try {
      await api.addCartItem(this.data.product.id, 1)
      await this.refreshCartCount()
      wx.switchTab({ url: '/pages/cart/index' })
    } catch (error) {
      wx.showToast({ title: error.error || '暂时无法创建订单', icon: 'none' })
    } finally {
      this.setData({ actionLoading: false })
    }
  }
})
