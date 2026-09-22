import { useEffect, useRef, useState } from 'react'
import { SECURITY_BANNER_EVENT } from '../lib/securityBanner'

/** Global top-of-screen banner shown when copy/paste/screenshot is blocked. Mount once, in AppShell. */
export default function SecurityBanner() {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ message: string }>).detail
      setMessage(detail.message)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setMessage(null), 2800)
    }
    window.addEventListener(SECURITY_BANNER_EVENT, handler)
    return () => window.removeEventListener(SECURITY_BANNER_EVENT, handler)
  }, [])

  return (
    <div
      role="alert"
      data-testid="security-banner"
      className={`fixed inset-x-0 top-0 z-50 flex justify-center transition-transform duration-300 ${
        message ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="mt-3 rounded-full border border-accent/40 bg-secondary px-4 py-2 text-sm font-medium text-accent shadow-lg">
        {message}
      </div>
    </div>
  )
}
