import { useEffect, useState } from 'react'
import { showSecurityBanner } from '../lib/securityBanner'

const BLUR_MESSAGE = 'Screenshots and screen recording are not supported — content is hidden while this window is inactive.'
const PRINT_SCREEN_MESSAGE = 'Screenshots are not supported on this page.'

/**
 * Blurs the page content on window blur / tab-hide, and flags PrintScreen
 * presses — a deterrent against casual screenshots, not a guarantee: OS
 * capture tools (Snipping Tool, Win+Shift+S) don't reliably fire `blur`,
 * and nothing here can stop a phone camera.
 */
export function useScreenCaptureGuard(): boolean {
  const [blurred, setBlurred] = useState(false)

  useEffect(() => {
    function handleBlur() {
      setBlurred(true)
      showSecurityBanner(BLUR_MESSAGE)
    }
    function handleFocus() {
      setBlurred(false)
    }
    function handleVisibility() {
      if (document.hidden) handleBlur()
      else handleFocus()
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'PrintScreen') showSecurityBanner(PRINT_SCREEN_MESSAGE)
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return blurred
}
