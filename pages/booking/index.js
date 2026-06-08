const api = require('../../utils/api.js')
const { requireLogin } = require('../../utils/auth.js')
const { formatPrice } = require('../../utils/format.js')
const { buildTravelDateCalendar, buildFallbackPriceCalendar } = require('../../utils/travel-date.js')
const {
  requestWechatPayment,
  waitForPaidOrder,
  isPaymentCancelled,
  isOrderPaid
} = require('../../utils/payment.js')

const DEFAULT_TRAVELER = {
  name: '',
  phone: '',
  gender: 'male',
  idCard: ''
}

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

function validIDCard(value) {
  const idCard = String(value || '').trim().toUpperCase()
  if (!/^\d{17}[\dX]$/.test(idCard)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let index = 0; index < 17; index += 1) {
    sum += Number(idCard[index]) * weights[index]
  }
  return idCard[17] === codes[sum % 11]
}

function normalizeTraveler(traveler) {
  return {
    name: String(traveler.name || '').trim(),
    phone: String(traveler.phone || '').trim(),
    gender: String(traveler.gender || '').trim() || 'male',
    idCard: String(traveler.idCard || '').trim().toUpperCase()
  }
}

function validateTraveler(traveler) {
  const nextTraveler = normalizeTraveler(traveler)
  if (!nextTraveler.name) return '请填写出行人姓名'
  if (!/^1[3-9]\d{9}$/.test(nextTraveler.phone)) return '请填写正确的手机号'
  if (nextTraveler.gender !== 'male' && nextTraveler.gender !== 'female') return '请选择出行人性别'
  if (!validIDCard(nextTraveler.idCard)) return '请填写正确的身份证号'
  return ''
}

function decorateTraveler(traveler, index) {
  return {
    ...traveler,
    genderText: traveler.gender === 'female' ? '女' : '男',
    maleClass: traveler.gender === 'male' ? 'gender-option gender-option-active' : 'gender-option',
    femaleClass: traveler.gender === 'female' ? 'gender-option gender-option-active' : 'gender-option',
    title: `出行人 ${index + 1}`,
    showRemove: index > 0
  }
}

function buildBookingViewState(state) {
  const unitPrice = Number(state.selectedTravelPrice || 0)
  const travelerCount = (state.travelers || []).length
  return {
    travelerCount,
    unitPriceText: formatPrice(unitPrice),
    totalAmountText: formatPrice(unitPrice * travelerCount),
    travelers: (state.travelers || []).map(decorateTraveler),
    submitDisabled: !state.product || !state.selectedTravelDate || travelerCount === 0
  }
}

Page({
  data: {
    productId: '',
    product: null,
    loading: false,
    submitting: false,
    showTravelDrawer: false,
    travelCalendarLookup: {},
    calendarMinDate: Date.now(),
    calendarMaxDate: Date.now(),
    calendarDefaultDate: Date.now(),
    calendarFormatter: null,
    selectedTravelDate: '',
    selectedTravelDateText: '',
    selectedTravelPrice: 0,
    selectedTravelPriceText: formatPrice(0),
    travelers: [{ ...DEFAULT_TRAVELER }],
    travelerCount: 1,
    unitPriceText: formatPrice(0),
    totalAmountText: formatPrice(0),
    submitDisabled: true
  },

  onLoad(options) {
    if (!requireLogin('登录后可填写出行信息')) {
      return
    }
    this.data.calendarFormatter = this.formatCalendarDay.bind(this)
    const productId = options && options.id ? options.id : ''
    if (!productId) {
      wx.showToast({ title: '缺少产品 ID', icon: 'none' })
      return
    }
    this.setData({ productId, selectedTravelDate: options.travelDate || '' })
    this.loadProduct(productId, options.travelDate || '')
  },

  setBookingState(partial) {
    const nextState = {
      ...this.data,
      ...partial
    }
    this.setData({
      ...partial,
      ...buildBookingViewState(nextState)
    })
  },

  async loadProduct(productId, preferredDate) {
    this.setBookingState({ loading: true })
    wx.showLoading({ title: '加载中' })
    try {
      const result = await api.getProductDetail(productId)
      const detail = result.productDetail || {}
      const rawCalendar = (detail.priceCalendar && detail.priceCalendar.length > 0)
        ? detail.priceCalendar
        : buildFallbackPriceCalendar(detail, 120)
      const travelCalendar = buildTravelDateCalendar(rawCalendar, preferredDate || '')
      const lookup = travelCalendar.days.reduce((acc, item) => {
        acc[item.date] = item
        return acc
      }, {})
      const calendarDates = travelCalendar.days.map((item) => toDateValue(item.date))
      const selectedDay = travelCalendar.selectedDay

      this.setBookingState({
        product: {
          ...detail,
          coverDisplayUrl: detail.coverImageUrl || detail.coverImage || '',
          descText: detail.shortDescription || detail.summary || '填写出行信息后即可预订',
          priceText: selectedDay ? selectedDay.priceText : formatPrice(detail.price)
        },
        travelCalendarLookup: lookup,
        calendarMinDate: calendarDates.length ? Math.min(...calendarDates) : Date.now(),
        calendarMaxDate: calendarDates.length ? Math.max(...calendarDates) : Date.now(),
        calendarDefaultDate: travelCalendar.selectedDate ? toDateValue(travelCalendar.selectedDate) : Date.now(),
        selectedTravelDate: travelCalendar.selectedDate,
        selectedTravelDateText: selectedDay ? selectedDay.dayLabel : '',
        selectedTravelPrice: selectedDay ? selectedDay.price : Number(detail.price || 0),
        selectedTravelPriceText: selectedDay ? selectedDay.priceText : formatPrice(detail.price || 0),
        loading: false
      })
      wx.setNavigationBarTitle({ title: '填写出行信息' })
    } catch (error) {
      wx.showToast({ title: error.error || '产品加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      if (this.data.loading) {
        this.setBookingState({ loading: false })
      }
    }
  },

  formatCalendarDay(day) {
    if (!day || !day.date) return day
    const travelDay = this.data.travelCalendarLookup[toDateKey(day.date)]
    if (!travelDay) return day
    return {
      ...day,
      topInfo: travelDay.holidayLabel || '',
      bottomInfo: travelDay.priceText,
      className: `travel-calendar-day travel-calendar-day-${travelDay.priceType}`
    }
  },

  openTravelDrawer() {
    this.setData({ showTravelDrawer: true })
  },

  closeTravelDrawer() {
    this.setData({ showTravelDrawer: false })
  },

  selectTravelDate(event) {
    const detail = event.detail || {}
    const selectedDate = Array.isArray(detail) ? detail[0] : detail
    const dateKey = toDateKey(selectedDate)
    if (!dateKey) return
    const selectedDay = this.data.travelCalendarLookup[dateKey] || null
    this.setBookingState({
      showTravelDrawer: false,
      calendarDefaultDate: selectedDate instanceof Date ? selectedDate.getTime() : this.data.calendarDefaultDate,
      selectedTravelDate: dateKey,
      selectedTravelDateText: selectedDay ? selectedDay.dayLabel : '',
      selectedTravelPrice: selectedDay ? selectedDay.price : Number(this.data.product && this.data.product.price || 0),
      selectedTravelPriceText: selectedDay ? selectedDay.priceText : formatPrice(this.data.product && this.data.product.price || 0)
    })
  },

  addTraveler() {
    if (this.data.travelers.length >= 20) {
      wx.showToast({ title: '最多添加 20 位出行人', icon: 'none' })
      return
    }
    this.setBookingState({
      travelers: this.data.travelers.concat([{ ...DEFAULT_TRAVELER }])
    })
  },

  removeTraveler(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (this.data.travelers.length <= 1) return
    const travelers = this.data.travelers.slice()
    travelers.splice(index, 1)
    this.setBookingState({ travelers })
  },

  updateTravelerField(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const travelers = this.data.travelers.map((item) => ({
      name: item.name || '',
      phone: item.phone || '',
      gender: item.gender || 'male',
      idCard: item.idCard || ''
    }))
    if (!travelers[index] || !field) return
    travelers[index][field] = event.detail.value
    this.setBookingState({ travelers })
  },

  selectGender(event) {
    const index = Number(event.currentTarget.dataset.index)
    const gender = event.currentTarget.dataset.gender
    const travelers = this.data.travelers.map((item) => ({
      name: item.name || '',
      phone: item.phone || '',
      gender: item.gender || 'male',
      idCard: item.idCard || ''
    }))
    if (!travelers[index]) return
    travelers[index].gender = gender
    this.setBookingState({ travelers })
  },

  validateTravelers() {
    for (let index = 0; index < this.data.travelers.length; index += 1) {
      const error = validateTraveler(this.data.travelers[index])
      if (error) {
        return `出行人${index + 1}：${error}`
      }
    }
    return ''
  },

  async submitOrder() {
    if (!requireLogin('登录后可提交订单')) return
    if (!this.data.product || this.data.submitting) return
    if (!this.data.selectedTravelDate) {
      wx.showToast({ title: '请选择出行日期', icon: 'none' })
      return
    }
    const error = this.validateTravelers()
    if (error) {
      wx.showToast({ title: error, icon: 'none' })
      return
    }

    const travelers = this.data.travelers.map(normalizeTraveler)
    this.setBookingState({ submitting: true })
    try {
      const result = await api.createDirectOrder(this.data.product.id, this.data.selectedTravelDate, travelers)
      const order = result.order || {}
      const payResult = await api.payOrder(order.id)
      const currentOrder = payResult.order || order
      if (!isOrderPaid(currentOrder)) {
        if (!payResult.paymentParams) {
          throw { error: '未获取到微信支付参数' }
        }
        await requestWechatPayment(payResult.paymentParams)
      }
      const paidOrder = isOrderPaid(currentOrder)
        ? currentOrder
        : await waitForPaidOrder(api, order.id)
      if (!isOrderPaid(paidOrder)) {
        wx.showToast({ title: '支付结果确认中，请稍后刷新订单', icon: 'none' })
        return
      }
      wx.redirectTo({ url: `/pages/order-detail/index?id=${paidOrder.id}` })
    } catch (submitError) {
      if (isPaymentCancelled(submitError)) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
        return
      }
      wx.showToast({ title: submitError.error || '订单提交失败', icon: 'none' })
    } finally {
      this.setBookingState({ submitting: false })
    }
  }
})
