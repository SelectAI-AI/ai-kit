import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import SecurityBanner from '../components/SecurityBanner'
import { showSecurityBanner } from '../lib/securityBanner'

beforeEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SecurityBanner', () => {
  it('is hidden (translated off-screen) with no message initially', () => {
    render(<SecurityBanner />)
    const banner = screen.getByTestId('security-banner')
    expect(banner.className).toContain('-translate-y-full')
  })

  it('shows the message and slides into view when showSecurityBanner is called', () => {
    render(<SecurityBanner />)
    act(() => {
      showSecurityBanner('Copying is disabled — please write your own code.')
    })

    const banner = screen.getByTestId('security-banner')
    expect(banner.className).toContain('translate-y-0')
    expect(banner).toHaveTextContent('Copying is disabled')
  })

  it('hides again after the timeout elapses', () => {
    vi.useFakeTimers()
    render(<SecurityBanner />)

    act(() => {
      showSecurityBanner('Pasting is disabled — please write your own code.')
    })
    expect(screen.getByTestId('security-banner').className).toContain('translate-y-0')

    act(() => {
      vi.advanceTimersByTime(2900)
    })
    expect(screen.getByTestId('security-banner').className).toContain('-translate-y-full')

    vi.useRealTimers()
  })

  it('replaces an in-flight message and resets the timeout when a new one arrives', () => {
    vi.useFakeTimers()
    render(<SecurityBanner />)

    act(() => {
      showSecurityBanner('First message')
    })
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    act(() => {
      showSecurityBanner('Second message')
    })

    expect(screen.getByTestId('security-banner')).toHaveTextContent('Second message')

    // Original timeout (would have fired at 2800ms from the first call) should
    // not hide the banner early — it was reset by the second call.
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByTestId('security-banner').className).toContain('translate-y-0')

    vi.useRealTimers()
  })
})
