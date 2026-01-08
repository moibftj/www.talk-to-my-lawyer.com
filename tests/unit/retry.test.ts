import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isRetryableError, retry, withTimeout } from '@/lib/utils/retry'

describe('retry helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries until success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelayMs: 0,
      maxDelayMs: 0,
      backoffMultiplier: 1,
    })

    await vi.runAllTimersAsync()
    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stops after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    const promise = retry(fn, {
      maxAttempts: 2,
      initialDelayMs: 0,
      maxDelayMs: 0,
      backoffMultiplier: 1,
    })

    await vi.runAllTimersAsync()
    await expect(promise).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('detects retryable errors', () => {
    expect(isRetryableError(new Error('Timeout waiting for response'))).toBe(true)
    expect(isRetryableError(new Error('Unknown issue'))).toBe(false)
  })

  it('times out long-running operations', async () => {
    const promise = withTimeout(() => new Promise(() => {}), 10, 'Timed out')
    await vi.advanceTimersByTimeAsync(20)
    await expect(promise).rejects.toThrow('Timed out')
  })
})
