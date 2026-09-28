import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useScreenCaptureGuard,
  BLUR_MESSAGE,
  PRINTSCREEN_MESSAGE,
} from "./useScreenCaptureGuard.js";
import { SECURITY_BANNER_EVENT } from "../lib/securityBanner.js";

// Unit tests for the Screen_Capture_Guard hook.
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5

/**
 * Register a spy listener for the security banner channel that records every
 * dispatched message. Returns { messages, cleanup }.
 */
function spyOnBanner() {
  const messages = [];
  const handler = (event) => {
    messages.push(event.detail.message);
  };
  window.addEventListener(SECURITY_BANNER_EVENT, handler);
  return {
    messages,
    cleanup: () => window.removeEventListener(SECURITY_BANNER_EVENT, handler),
  };
}

/**
 * Override document.hidden / document.visibilityState and dispatch a
 * "visibilitychange" event, so the guard's handler observes the desired state.
 */
function setVisibility(hidden) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

// Track which document properties we overrode so we can restore them.
let overrodeVisibility = false;

afterEach(() => {
  // Restore any overridden document properties.
  if (overrodeVisibility) {
    delete document.hidden;
    delete document.visibilityState;
    overrodeVisibility = false;
  }
  // Restore real timers if a test enabled fake ones.
  vi.useRealTimers();
});

describe("useScreenCaptureGuard - blur/focus (Req 3.1, 3.3)", () => {
  it("sets blurred true on window blur and false on window focus", () => {
    const banner = spyOnBanner();
    try {
      const { result } = renderHook(() => useScreenCaptureGuard());
      expect(result.current).toBe(false);

      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(result.current).toBe(true);

      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      expect(result.current).toBe(false);
    } finally {
      banner.cleanup();
    }
  });
});

describe("useScreenCaptureGuard - visibilitychange (Req 3.2, 3.4)", () => {
  it("sets blurred true when hidden and false when visible", () => {
    const banner = spyOnBanner();
    try {
      const { result } = renderHook(() => useScreenCaptureGuard());
      expect(result.current).toBe(false);

      overrodeVisibility = true;
      setVisibility(true);
      expect(result.current).toBe(true);

      setVisibility(false);
      expect(result.current).toBe(false);
    } finally {
      banner.cleanup();
    }
  });
});

describe("useScreenCaptureGuard - blur banner de-duplication (Req 3.6, 3.8)", () => {
  it("dispatches exactly one blur banner on false->true and none on repeated blur while blurred", () => {
    const banner = spyOnBanner();
    try {
      const { result } = renderHook(() => useScreenCaptureGuard());

      // First blur: false -> true transition dispatches exactly one banner.
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(result.current).toBe(true);
      expect(banner.messages).toEqual([BLUR_MESSAGE]);

      // Repeated blur while already blurred: stays true, no extra banner.
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(result.current).toBe(true);
      expect(banner.messages).toEqual([BLUR_MESSAGE]);

      // A hidden visibilitychange while already blurred also adds no banner.
      overrodeVisibility = true;
      setVisibility(true);
      expect(result.current).toBe(true);
      expect(banner.messages).toEqual([BLUR_MESSAGE]);
    } finally {
      banner.cleanup();
    }
  });

  it("dispatches the blur banner again after focus resets the state (blur->focus->blur)", () => {
    const banner = spyOnBanner();
    try {
      renderHook(() => useScreenCaptureGuard());

      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });

      expect(banner.messages).toEqual([BLUR_MESSAGE, BLUR_MESSAGE]);
    } finally {
      banner.cleanup();
    }
  });
});

describe("useScreenCaptureGuard - PrintScreen keyup (Req 4.1, 4.2)", () => {
  it("dispatches exactly one banner for PrintScreen and none for other keys", () => {
    const banner = spyOnBanner();
    try {
      renderHook(() => useScreenCaptureGuard());

      // A non-PrintScreen key dispatches nothing (Req 4.2).
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "a" }));
      });
      expect(banner.messages).toEqual([]);

      // PrintScreen dispatches exactly one banner (Req 4.1).
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "PrintScreen" }));
      });
      expect(banner.messages).toEqual([PRINTSCREEN_MESSAGE]);
    } finally {
      banner.cleanup();
    }
  });
});

describe("useScreenCaptureGuard - PrintScreen dedup window (Req 4.3, 4.4)", () => {
  it("suppresses repeated PrintScreen within the dismiss window and allows a new one after 2800ms", () => {
    vi.useFakeTimers();
    const banner = spyOnBanner();
    try {
      renderHook(() => useScreenCaptureGuard());

      // First PrintScreen dispatches one banner.
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "PrintScreen" }));
      });
      expect(banner.messages).toEqual([PRINTSCREEN_MESSAGE]);

      // Repeated PrintScreen within the dismiss window adds nothing (Req 4.3).
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "PrintScreen" }));
      });
      expect(banner.messages).toEqual([PRINTSCREEN_MESSAGE]);

      // The notice persists for the dismiss interval: still no new banner just
      // before 2800ms elapses (Req 4.4).
      act(() => {
        vi.advanceTimersByTime(2799);
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "PrintScreen" }));
      });
      expect(banner.messages).toEqual([PRINTSCREEN_MESSAGE]);

      // After advancing past 2800ms the notice clears and a new PrintScreen
      // dispatches again (Req 4.3).
      act(() => {
        vi.advanceTimersByTime(2);
      });
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "PrintScreen" }));
      });
      expect(banner.messages).toEqual([PRINTSCREEN_MESSAGE, PRINTSCREEN_MESSAGE]);
    } finally {
      banner.cleanup();
    }
  });
});

describe("useScreenCaptureGuard - absent key data (Req 4.5)", () => {
  it("does not dispatch a banner and does not throw when key data is absent", () => {
    const banner = spyOnBanner();
    try {
      renderHook(() => useScreenCaptureGuard());

      // KeyboardEvent with no key provided -> key defaults to "" in jsdom;
      // construct an event whose key is explicitly null/undefined to exercise
      // the `e.key == null` guard.
      const nullKeyEvent = new KeyboardEvent("keyup");
      Object.defineProperty(nullKeyEvent, "key", {
        configurable: true,
        get: () => null,
      });
      expect(() => {
        act(() => {
          window.dispatchEvent(nullKeyEvent);
        });
      }).not.toThrow();
      expect(banner.messages).toEqual([]);

      const undefinedKeyEvent = new KeyboardEvent("keyup");
      Object.defineProperty(undefinedKeyEvent, "key", {
        configurable: true,
        get: () => undefined,
      });
      expect(() => {
        act(() => {
          window.dispatchEvent(undefinedKeyEvent);
        });
      }).not.toThrow();
      expect(banner.messages).toEqual([]);
    } finally {
      banner.cleanup();
    }
  });
});
