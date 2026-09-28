// Screen_Capture_Guard: tracks whether the window is active/visible and drives
// a full-app blur while inactive, and flags PrintScreen key presses. This is a
// best-effort deterrent only — a web app cannot stop OS capture tools or a
// phone camera, and some OS capture tools do not fire browser blur/visibility
// events. Surfaces notices through the context-free banner channel.

import { useEffect, useRef, useState } from "react";
import { showSecurityBanner } from "../lib/securityBanner";

/**
 * Notice shown while the window is inactive / the tab is hidden (Req 3.6).
 * @type {string}
 */
export const BLUR_MESSAGE =
  "Content is hidden while this window is inactive.";

/**
 * Notice shown when PrintScreen is pressed (Req 4.1).
 * @type {string}
 */
export const PRINTSCREEN_MESSAGE =
  "Screenshots are not supported for this content.";

/**
 * How long the PrintScreen notice is considered active for de-duplication,
 * matching the banner's dismiss interval (Req 4.3, 4.4).
 * @type {number}
 */
const PRINTSCREEN_NOTICE_MS = 2800;

/**
 * Track window active/inactive state and PrintScreen presses.
 *
 * @returns {boolean} blurred — true while the window is inactive/hidden.
 */
export function useScreenCaptureGuard() {
  const [blurred, setBlurred] = useState(false);

  // True while a PrintScreen notice is considered active, so repeated
  // PrintScreen keyups within the dismiss window do not re-dispatch (Req 4.3).
  const printScreenActiveRef = useRef(false);
  const printScreenTimerRef = useRef(null);

  useEffect(() => {
    // Transition into the blurred state. Only dispatch the blur banner on a
    // genuine false -> true transition so a second blur while already blurred
    // does NOT dispatch a second banner (Req 3.1, 3.6, 3.8).
    const goBlurred = () => {
      setBlurred((prev) => {
        if (!prev) {
          showSecurityBanner(BLUR_MESSAGE);
        }
        return true;
      });
    };

    // Transition out of the blurred state (Req 3.3). No banner on unblur; a
    // later blur (blur -> focus -> blur) will dispatch again (Req 3.8).
    const goUnblurred = () => {
      setBlurred(false);
    };

    const handleBlur = () => {
      goBlurred();
    };

    const handleFocus = () => {
      goUnblurred();
    };

    // Hidden behaves like blur, visible behaves like focus (Req 3.2, 3.4).
    const handleVisibilityChange = () => {
      if (document.hidden) {
        goBlurred();
      } else {
        goUnblurred();
      }
    };

    const handleKeyUp = (e) => {
      // Absent key identification data — do nothing (Req 4.5).
      if (e.key == null) {
        return;
      }
      // Any key other than PrintScreen dispatches nothing (Req 4.2).
      if (e.key !== "PrintScreen") {
        return;
      }
      // Already-active notice — suppress duplicate dispatch (Req 4.3).
      if (printScreenActiveRef.current) {
        return;
      }

      printScreenActiveRef.current = true;
      showSecurityBanner(PRINTSCREEN_MESSAGE);

      // Clear the "notice active" flag after the dismiss interval so a later
      // PrintScreen can surface the notice again (Req 4.3, 4.4).
      printScreenTimerRef.current = setTimeout(() => {
        printScreenActiveRef.current = false;
        printScreenTimerRef.current = null;
      }, PRINTSCREEN_NOTICE_MS);
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (printScreenTimerRef.current != null) {
        clearTimeout(printScreenTimerRef.current);
        printScreenTimerRef.current = null;
      }
      printScreenActiveRef.current = false;
    };
  }, []);

  return blurred;
}
