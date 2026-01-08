import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateDiscountAmount,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  generateCouponCode,
  getStatusBadgeClasses,
} from '@/lib/helpers'

describe('helpers', () => {
  it('formats currency in USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('formats ISO dates to a readable string', () => {
    const iso = new Date(2024, 0, 15, 9, 0, 0).toISOString()
    const result = formatDate(iso)
    expect(result).toContain('January')
    expect(result).toContain('2024')
  })

  it('calculates percentage discounts', () => {
    expect(calculateDiscountAmount(200, 15)).toBe(30)
  })

  it('returns status badge classes', () => {
    expect(getStatusBadgeClasses('approved')).toBe('bg-green-100 text-green-800')
    expect(getStatusBadgeClasses('unknown')).toBe('bg-slate-100 text-slate-800')
  })

  it('generates coupon codes from names', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1234)
    expect(generateCouponCode('Jane Doe')).toBe('JANE4FXC')
    randomSpy.mockRestore()
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats short relative times', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 30_000).toISOString())).toBe('just now')
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 60_000).toISOString())).toBe('2m ago')
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60_000).toISOString())).toBe('3h ago')
    expect(formatRelativeTime(new Date(now.getTime() - 4 * 24 * 60 * 60_000).toISOString())).toBe('4d ago')
  })
})
