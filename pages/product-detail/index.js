const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')
const { buildTravelDateCalendar, buildFallbackPriceCalendar } = require('../../utils/travel-date.js')

function toDateKey(date) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateValue(dateKey) {
  if (!dateKey) return Date.now()
  const value = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(value.getTime()) ? Date.now() : value.getTime()
}

Page({
  data: {
    product: null,
    images: [],
    detailImages: [],
    travelCalendarLookup: {},
    calendarMinDate: Date.now(),
    calendarMaxDate: Date.now(),
    calendarDefaultDate: Date.now(),
    calendarFormatter: null,
    drawerSummaryText: '请选择日期',
    selectedTravelDate: '',
    selectedTravelDateText: '',
    selectedTravelPriceText: formatPrice(0),
    showTravelDrawer: false,
    detailScrollEnabled: true,
    actionLoading: false,
    cartCount: 0,
    cartBadgeText: ''
  },

  onLoad(options) {
    this.data.calendarFormatter = this.formatCalendarDay.bind(this)
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
      const travelCalendarLookup = travelCalendar.days.reduce((acc, item) => {
        acc[item.date] = item
        return acc
      }, {})
      const calendarDates = travelCalendar.days.map((item) => toDateValue(item.date))
      const calendarMinDate = calendarDates.length ? Math.min(...calendarDates) : Date.now()
      const calendarMaxDate = calendarDates.length ? Math.max(...calendarDates) : Date.now()
      const selectedDateValue = travelCalendar.selectedDate ? toDateValue(travelCalendar.selectedDate) : Date.now()
      const product = {
        ...detail,
        priceText: travelCalendar.selectedPriceText || formatPrice(detail.price),
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
        travelCalendarLookup,
        calendarMinDate,
        calendarMaxDate,
        calendarDefaultDate: selectedDateValue,
        drawerSummaryText: travelCalendar.selectedDay ? travelCalendar.selectedDay.dayLabel : '请选择日期',
        selectedTravelDate: travelCalendar.selectedDate,
        selectedTravelDateText: travelCalendar.selectedDay ? travelCalendar.selectedDay.dayLabel : '',
        selectedTravelPriceText: travelCalendar.selectedPriceText || formatPrice(product.price)
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

  formatCalendarDay(day) {
    if (!day || !day.date) {
      return day
    }

    const travelDay = this.data.travelCalendarLookup[toDateKey(day.date)]
    if (!travelDay) {
      return day
    }

    return {
      ...day,
      topInfo: travelDay.holidayLabel || '',
      bottomInfo: travelDay.priceText,
      className: `travel-calendar-day travel-calendar-day-${travelDay.priceType}`
    }
  },

  openTravelDrawer() {
    this.setData({
      showTravelDrawer: true,
      detailScrollEnabled: false
    })
  },

  closeTravelDrawer() {
    this.setData({
      showTravelDrawer: false,
      detailScrollEnabled: true
    })
  },

  selectTravelDate(event) {
    const detail = event.detail || {}
    const selectedDate = Array.isArray(detail) ? detail[0] : detail
    const dateKey = toDateKey(selectedDate)
    if (!dateKey) {
      return
    }

    const selectedDay = this.data.travelCalendarLookup[dateKey] || null
    const nextPriceText = selectedDay ? selectedDay.priceText : formatPrice(this.data.product && this.data.product.price)

    this.setData({
      showTravelDrawer: false,
      detailScrollEnabled: true,
      calendarDefaultDate: selectedDate instanceof Date ? selectedDate.getTime() : this.data.calendarDefaultDate,
      drawerSummaryText: selectedDay ? selectedDay.dayLabel : '请选择日期',
      selectedTravelDate: dateKey,
      selectedTravelDateText: selectedDay ? selectedDay.dayLabel : '',
      selectedTravelPriceText: nextPriceText,
      product: this.data.product
        ? {
            ...this.data.product,
            priceText: nextPriceText
          }
        : null
    })
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
    if (!this.data.selectedTravelDate) {
      wx.showToast({ title: '请选择出行日期', icon: 'none' })
      return
    }

    this.setData({ actionLoading: true })
    try {
      await api.addCartItem(this.data.product.id, 1, this.data.selectedTravelDate)
      await this.refreshCartCount()
      wx.switchTab({ url: '/pages/cart/index' })
    } catch (error) {
      wx.showToast({ title: error.error || '暂时无法创建订单', icon: 'none' })
    } finally {
      this.setData({ actionLoading: false })
    }
  }
})
