const api = require('../../utils/api')
const { requireLogin } = require('../../utils/auth')
const { formatPrice } = require('../../utils/format')

Page({
  data: {
    product: null,
    images: [],
    detailImages: []
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '缺少产品 ID', icon: 'none' })
      return
    }
    this.loadDetail(options.id)
  },

  async loadDetail(id) {
    wx.showLoading({ title: '加载中' })
    try {
      const result = await api.getProductDetail(id)
      const product = {
        ...result.productDetail,
        priceText: formatPrice(result.productDetail.price)
      }
      const images = product.bannerImageUrls && product.bannerImageUrls.length
        ? product.bannerImageUrls
        : [product.coverImageUrl || product.coverImage]
      const detailImages = product.detailImageUrls && product.detailImageUrls.length
        ? product.detailImageUrls
        : product.detailImages || []
      this.setData({ product, images: images.filter(Boolean), detailImages: detailImages.filter(Boolean) })
      wx.setNavigationBarTitle({ title: product.title || '产品详情' })
    } catch (error) {
      wx.showToast({ title: error.error || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
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

  reserve() {
    if (!requireLogin('登录后可提交预订信息')) {
      return
    }
    wx.showToast({ title: '预订功能即将开放', icon: 'none' })
  }
})
