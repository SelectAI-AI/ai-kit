import React, { useEffect, useRef, useState } from "react";
import { SECURITY_BANNER_EVENT } from "../lib/securityBanner";

// Security_Banner: a single transient top-of-screen notice, mounted once at the
// app root. It listens on the Banner_Channel event and auto-dismisses after a
// fixed interval. Display-only length rules (200-char cap) live here; the
// channel itself carries messages verbatim.

const DISMISS_MS = 2800;
const MAX_DISPLAY_CHARS = 200;

export default function SecurityBanner() {
  const [message, setMessage] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    function clearPendingTimer() {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function handleBannerEvent(e) {
      const raw = e?.detail?.message;

      // Ignore missing/empty messages: keep current message, do not restart timer.
      if (typeof raw !== "string" || raw.length === 0) {
        return;
      }

      // Truncate over-length messages to the first 200 characters for display.
      const next = raw.length > MAX_DISPLAY_CHARS ? raw.slice(0, MAX_DISPLAY_CHARS) : raw;

      // Accepted message: set text, restart the dismiss timer from zero.
      setMessage(next);
      clearPendingTimer();
      timeoutRef.current = setTimeout(() => {
        setMessage(null);
        timeoutRef.current = null;
      }, DISMISS_MS);
    }

    window.addEventListener(SECURITY_BANNER_EVENT, handleBannerEvent);

    return () => {
      window.removeEventListener(SECURITY_BANNER_EVENT, handleBannerEvent);
      clearPendingTimer();
    };
  }, []);

  if (message == null) {
    return null;
  }

  return (
    <div
      data-testid="security-banner"
      role="alert"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2 rounded-md border border-brass-500 bg-ink-900 text-paper-100 text-sm font-medium text-center shadow-lg"
    >
      {message}
    </div>
  );
}
