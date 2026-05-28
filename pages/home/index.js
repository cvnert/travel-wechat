const api = require('../../utils/api')
const { formatPrice } = require('../../utils/format')

function normalizeFeaturedProducts(list) {
  return (list || []).map((item) => {
    const cover = item.coverImageUrl || item.coverImage
    const images = item.bannerImageUrls && item.bannerImageUrls.length
      ? item.bannerImageUrls
      : cover
        ? [cover]
        : []
    return {
      ...item,
      priceText: formatPrice(item.price),
      coverDisplayUrl: cover,
      bannerDisplayUrls: images.filter(Boolean)
    }
  })
}

Page({
  data: {
    loading: false,
    listLoading: false,
    isLoggedIn: false,
    page: 1,
    pageSize: 12,
    hasMore: true,
    home: {
      location: '滇西北',
      brandName: '旅邦旅游',
      sectionTitle: '线路预订',
      sectionSubtitle: '精选旅行线路、活动套餐与周边服务',
      quickCategories: [],
      heroBanners: [],
      featuredProducts: []
    },
    products: [],
    fallbackProducts: [],
    swiperImages: []
  },

  onLoad() {
    this.loadHome()
  },

  onShow() {
    this.setData({ isLoggedIn: Boolean(wx.getStorageSync('token')) })
  },

  onPullDownRefresh() {
    this.loadHome().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadMoreProducts()
    }
  },

  async loadHome() {
    this.setData({ loading: true })
    try {
      const result = await api.getHomeContent()
      const home = result.home || {}
      const featuredProducts = normalizeFeaturedProducts(home.featuredProducts || [])
      const swiperImages = (home.heroBanners || []).map((item) => item.imageUrl).filter(Boolean)
      this.setData({
        home: {
          location: home.location || '滇西北',
          brandName: home.brandName || '旅邦旅游',
          sectionTitle: home.sectionTitle || '线路预订',
          sectionSubtitle: home.sectionSubtitle || '精选旅行线路、活动套餐与周边服务',
          quickCategories: home.quickCategories || [],
          heroBanners: home.heroBanners || [],
          featuredProducts
        },
        products: featuredProducts,
        fallbackProducts: featuredProducts,
        swiperImages: swiperImages.length ? swiperImages : featuredProducts.map((item) => item.coverDisplayUrl).filter(Boolean),
        page: 2,
        hasMore: featuredProducts.length >= this.data.pageSize
      })
      if (featuredProducts.length === 0) {
        await this.loadProducts(true)
      }
    } catch (error) {
      await this.loadProducts(true)
      wx.showToast({ title: error.error || '首页内容加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadProducts(reset) {
    const page = reset ? 1 : this.data.page
    this.setData({ listLoading: true })
    try {
      const result = await api.getProducts(page, this.data.pageSize)
      const nextProducts = normalizeFeaturedProducts(result.productList || [])
      const products = reset ? nextProducts : this.data.products.concat(nextProducts)
      this.setData({
        products,
        fallbackProducts: reset ? nextProducts : this.data.fallbackProducts.concat(nextProducts),
        page: page + 1,
        hasMore: products.length < Number(result.total || 0),
        swiperImages: this.data.swiperImages.length ? this.data.swiperImages : products.map((item) => item.coverDisplayUrl).filter(Boolean)
      })
    } catch (error) {
      wx.showToast({ title: error.error || '加载失败', icon: 'none' })
    } finally {
      this.setData({ listLoading: false })
    }
  },

  async loadMoreProducts() {
    await this.loadProducts(false)
  },

  goDetail(event) {
    const id = event.currentTarget.dataset.id || event.target.dataset.id
    if (!id) {
      wx.showToast({ title: '缺少产品 ID', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/product-detail/index?id=${id}` })
  },

  goLogin() {
    wx.switchTab({ url: '/pages/profile/index' })
  }
})
