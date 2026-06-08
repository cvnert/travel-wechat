const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')
const { buildTravelDateCalendar, buildFallbackPriceCalendar } = require('../../utils/travel-date.js')

Page({
  data: {
    product: null,
    images: [],
    detailImages: [],
    selectedTravelDate: '',
    detailScrollEnabled: true,
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
      const detail = result.productDetail || {}
      const summaryText = detail.summary || detail.shortDescription || ''
      const rawCalendar = (detail.priceCalendar && detail.priceCalendar.length > 0)
        ? detail.priceCalendar
        : buildFallbackPriceCalendar(detail, 120)
      const travelCalendar = buildTravelDateCalendar(rawCalendar, '')
      const product = {
        ...detail,
        priceText: formatPrice(detail.price),
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
        detailImages: detailImages.filter(Boolean),
        selectedTravelDate: travelCalendar.selectedDate
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
    if (!this.data.selectedTravelDate) {
      wx.showToast({ title: '请选择出行日期', icon: 'none' })
      return
    }

    this.setData({ actionLoading: true })
    try {
      await api.addCartItem(this.data.product.id, 1, this.data.selectedTravelDate)
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
    wx.navigateTo({
      url: `/pages/booking/index?id=${this.data.product.id}`
    })
  }
})
