// Banner_Channel: a context-free event bus any code can call to surface a
// transient security notice. Dispatches a browser CustomEvent on the global
// target so no React context/provider is required.

/**
 * Name of the custom event used to broadcast security banner notices.
 * Stable, non-empty string identical across all imports within a session.
 * @type {string}
 */
export const SECURITY_BANNER_EVENT = "app:security-banner";

/**
 * Resolve a global event target defensively without throwing.
 * @returns {(EventTarget & { dispatchEvent: Function }) | null}
 */
function resolveGlobalTarget() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    return window;
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.dispatchEvent === "function") {
    return globalThis;
  }
  return null;
}

/**
 * Dispatch a security banner notice.
 *
 * The message is placed in the event's `detail.message` verbatim — no trim,
 * encode, or truncate. Length-based display rules live in the banner component.
 *
 * @param {string} message - The notice text to broadcast.
 * @returns {boolean} true if an event was dispatched; false if the input was
 *   rejected (not a string) or no global event target was available.
 */
export function showSecurityBanner(message) {
  if (typeof message !== "string") {
    return false;
  }

  const target = resolveGlobalTarget();
  if (!target) {
    return false;
  }

  target.dispatchEvent(
    new CustomEvent(SECURITY_BANNER_EVENT, { detail: { message } })
  );
  return true;
}
