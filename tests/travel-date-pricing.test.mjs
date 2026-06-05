import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildTravelDateCalendar, buildFallbackPriceCalendar } = require('../utils/travel-date.js')

test('buildTravelDateCalendar groups days by month and keeps selected date pricing', () => {
  const calendar = buildTravelDateCalendar(
    [
      { date: '2026-06-19', price: 399.5, priceType: 'holiday', holidayLabel: '端午', isSelectable: true },
      { date: '2026-06-20', price: 399.5, priceType: 'holiday', holidayLabel: '端午', isSelectable: true },
      { date: '2026-07-01', price: 299.5, priceType: 'weekday', isSelectable: true }
    ],
    '2026-06-20'
  )

  assert.equal(calendar.months.length, 2)
  assert.equal(calendar.selectedDate, '2026-06-20')
  assert.equal(calendar.selectedPriceText, '¥399.50')
  assert.equal(calendar.days[1].isSelected, true)
  assert.equal(calendar.days[1].priceText, '¥399.50')
})

test('buildFallbackPriceCalendar generates future selectable dates when backend calendar is missing', () => {
  const days = buildFallbackPriceCalendar({
    price: 100,
    weekdayPrice: 120,
    weekendPrice: 150,
    holidayPrice: 200
  }, 7)

  assert.equal(days.length, 7)
  assert.ok(days.every((item) => item.isSelectable))
  assert.ok(days.some((item) => item.price === 120 || item.price === 150 || item.price === 200))
})
