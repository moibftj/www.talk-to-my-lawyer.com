import { describe, it, expect } from 'vitest'
import { combineClassNames, formatDateString } from '@/lib/utils'

describe('combineClassNames', () => {
  it('merges class names and ignores falsy values', () => {
    const result = combineClassNames('alpha', false && 'skip', 'beta')
    expect(result).toBe('alpha beta')
  })
})

describe('formatDateString', () => {
  it('formats dates with known patterns', () => {
    const date = new Date(2024, 0, 15, 12, 34, 0)
    expect(formatDateString(date, 'MMM d, yyyy')).toBe('Jan 15, 2024')
    expect(formatDateString(date, 'MMM d, yyyy h:mm a')).toBe('Jan 15, 2024 12:34 PM')
  })

  it('falls back to locale date for unknown pattern', () => {
    const date = new Date(2024, 0, 15, 12, 34, 0)
    expect(formatDateString(date, 'unknown')).toBe(date.toLocaleDateString())
  })
})
