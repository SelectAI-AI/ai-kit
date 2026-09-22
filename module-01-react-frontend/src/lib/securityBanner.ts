// Shared channel for the top-of-screen "blocked" banner (SecurityBanner.tsx).
// Any component can call showSecurityBanner() without needing a React context.

export const SECURITY_BANNER_EVENT = 'app:security-banner'

export function showSecurityBanner(message: string) {
  window.dispatchEvent(new CustomEvent(SECURITY_BANNER_EVENT, { detail: { message } }))
}
