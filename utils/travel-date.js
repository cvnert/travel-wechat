const { formatPrice } = require('./format.js')

const PRICE_TYPE_WEEKDAY = 'weekday'
const PRICE_TYPE_WEEKEND = 'weekend'
const PRICE_TYPE_HOLIDAY = 'holiday'

const HOLIDAY_RULES = {
  2026: {
    holidays: {
      '2026-01-01': '元旦',
      '2026-01-02': '元旦',
      '2026-01-03': '元旦',
      '2026-02-15': '春节',
      '2026-02-16': '春节',
      '2026-02-17': '春节',
      '2026-02-18': '春节',
      '2026-02-19': '春节',
      '2026-02-20': '春节',
      '2026-02-21': '春节',
      '2026-02-22': '春节',
      '2026-02-23': '春节',
      '2026-04-04': '清明',
      '2026-04-05': '清明',
      '2026-04-06': '清明',
      '2026-05-01': '劳动节',
      '2026-05-02': '劳动节',
      '2026-05-03': '劳动节',
      '2026-05-04': '劳动节',
      '2026-05-05': '劳动节',
      '2026-06-19': '端午',
      '2026-06-20': '端午',
      '2026-06-21': '端午',
      '2026-09-25': '中秋',
      '2026-09-26': '中秋',
      '2026-09-27': '中秋',
      '2026-10-01': '国庆',
      '2026-10-02': '国庆',
      '2026-10-03': '国庆',
      '2026-10-04': '国庆',
      '2026-10-05': '国庆',
      '2026-10-06': '国庆',
      '2026-10-07': '国庆'
    },
    makeupWorkdays: {
      '2026-01-04': true,
      '2026-02-14': true,
      '2026-02-28': true,
      '2026-05-09': true,
      '2026-09-20': true,
      '2026-10-10': true
    }
  }
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function classifyDate(date) {
  const key = toDateKey(date)
  const rule = HOLIDAY_RULES[date.getFullYear()]
  if (rule && rule.holidays[key]) {
    return {
      priceType: PRICE_TYPE_HOLIDAY,
      holidayLabel: rule.holidays[key]
    }
  }
  if (rule && rule.makeupWorkdays[key]) {
    return {
      priceType: PRICE_TYPE_WEEKDAY,
      holidayLabel: ''
    }
  }
  const weekday = date.getDay()
  if (weekday === 0 || weekday === 6) {
    return {
      priceType: PRICE_TYPE_WEEKEND,
      holidayLabel: ''
    }
  }
  return {
    priceType: PRICE_TYPE_WEEKDAY,
    holidayLabel: ''
  }
}

function resolvePrice(product, priceType) {
  const basePrice = Number(product && product.price != null ? product.price : 0)
  const weekdayPrice = Number(product && product.weekdayPrice != null ? product.weekdayPrice : basePrice)
  const weekendPrice = Number(product && product.weekendPrice != null ? product.weekendPrice : basePrice)
  const holidayPrice = Number(product && product.holidayPrice != null ? product.holidayPrice : basePrice)
  if (priceType === PRICE_TYPE_HOLIDAY) return holidayPrice
  if (priceType === PRICE_TYPE_WEEKEND) return weekendPrice
  return weekdayPrice
}

function buildFallbackPriceCalendar(product, dayCount = 120) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const list = []
  for (let i = 0; i < dayCount; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const meta = classifyDate(date)
    list.push({
      date: toDateKey(date),
      price: resolvePrice(product || {}, meta.priceType),
      priceType: meta.priceType,
      holidayLabel: meta.holidayLabel,
      isSelectable: true
    })
  }
  return list
}

function formatDateLabel(dateValue) {
  if (!dateValue) return ''
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}月${day}日`
}

function buildTravelDateCalendar(days, selectedDate) {
  const safeDays = Array.isArray(days) ? days.slice() : []
  const normalizedDays = safeDays.map((item) => {
    const date = String(item && item.date ? item.date : '').trim()
    const price = Number(item && item.price != null ? item.price : 0)
    const priceType = String(item && item.priceType ? item.priceType : 'weekday')
    const holidayLabel = String(item && item.holidayLabel ? item.holidayLabel : '')
    return {
      ...item,
      date,
      price,
      priceType,
      holidayLabel,
      monthKey: date.slice(0, 7),
      monthLabel: date ? `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月` : '',
      dayText: date ? date.slice(8, 10) : '',
      dayLabel: formatDateLabel(date),
      priceText: formatPrice(price),
      dayClass: `calendar-day calendar-day-${priceType}${date === selectedDate ? ' calendar-day-selected' : ''}${item.isSelectable === false ? ' calendar-day-disabled' : ''}`,
      isSelected: date === selectedDate
    }
  })

  const resolvedSelectedDate = normalizedDays.some((item) => item.date === selectedDate)
    ? selectedDate
    : (normalizedDays.find((item) => item.isSelectable !== false) || normalizedDays[0] || {}).date || ''

  const nextDays = normalizedDays.map((item) => ({
    ...item,
    isSelected: item.date === resolvedSelectedDate
  }))

  const monthMap = new Map()
  nextDays.forEach((item) => {
    if (!item.monthKey) return
    if (!monthMap.has(item.monthKey)) {
      monthMap.set(item.monthKey, {
        key: item.monthKey,
        label: item.monthLabel,
        days: [],
        cells: []
      })
    }
    monthMap.get(item.monthKey).days.push(item)
  })

  const months = Array.from(monthMap.values()).map((month) => {
    const [year, monthValue] = month.key.split('-').map(Number)
    const firstDay = new Date(year, monthValue - 1, 1).getDay()
    const emptyCells = Array.from({ length: firstDay }, (_, index) => ({
      key: `${month.key}-empty-${index}`,
      isEmpty: true,
      dayClass: 'calendar-day calendar-day-empty'
    }))
    return {
      ...month,
      cells: emptyCells.concat(month.days)
    }
  })
  const selectedDay = nextDays.find((item) => item.isSelected) || null

  return {
    days: nextDays,
    months,
    selectedDate: resolvedSelectedDate,
    selectedDay,
    selectedPriceText: selectedDay ? selectedDay.priceText : formatPrice(0)
  }
}

module.exports = {
  buildTravelDateCalendar,
  buildFallbackPriceCalendar
}
