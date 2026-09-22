import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScreenCaptureGuard } from '../hooks/useScreenCaptureGuard'
import { SECURITY_BANNER_EVENT } from '../lib/securityBanner'

function bannerMessages(): string[] {
  return vi.mocked(window.dispatchEvent).mock.calls
    .map(call => call[0] as CustomEvent<{ message: string }>)
    .filter(e => e.type === SECURITY_BANNER_EVENT)
    .map(e => e.detail.message)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'dispatchEvent')
})

describe('useScreenCaptureGuard', () => {
  it('starts not blurred', () => {
    const { result } = renderHook(() => useScreenCaptureGuard())
    expect(result.current).toBe(false)
  })

  it('blurs and shows a banner on window blur', () => {
    const { result } = renderHook(() => useScreenCaptureGuard())
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(result.current).toBe(true)
    expect(bannerMessages().some(m => m.includes('Screenshots and screen recording'))).toBe(true)
  })

  it('unblurs on window focus', () => {
    const { result } = renderHook(() => useScreenCaptureGuard())
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(false)
  })

  it('shows a distinct banner on PrintScreen keyup without blurring', () => {
    const { result } = renderHook(() => useScreenCaptureGuard())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'PrintScreen' }))
    })
    expect(result.current).toBe(false)
    expect(bannerMessages()).toEqual(['Screenshots are not supported on this page.'])
  })

  it('ignores unrelated keyup events', () => {
    renderHook(() => useScreenCaptureGuard())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))
    })
    expect(bannerMessages()).toEqual([])
  })
})
