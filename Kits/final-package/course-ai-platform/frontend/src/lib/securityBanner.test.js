// Example / edge-case unit tests for the Banner_Channel (src/lib/securityBanner.js).
// Framework: Vitest (globals) + jsdom.
// Covers Requirements 5.1, 5.2, 5.4, 5.5.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SECURITY_BANNER_EVENT, showSecurityBanner } from "./securityBanner.js";

describe("securityBanner channel — SECURITY_BANNER_EVENT constant (Req 5.1)", () => {
  it("is a non-empty string", () => {
    expect(typeof SECURITY_BANNER_EVENT).toBe("string");
    expect(SECURITY_BANNER_EVENT.length).toBeGreaterThan(0);
  });

  it("is identical across separate imports of the module", async () => {
    // Re-import the module and confirm the constant is strictly equal — a stable
    // value shared across all imports within a single application session.
    const reimported = await import("./securityBanner.js");
    expect(reimported.SECURITY_BANNER_EVENT).toBe(SECURITY_BANNER_EVENT);
  });
});

describe("securityBanner channel — valid string dispatch (Req 5.2)", () => {
  let received;
  let listener;

  beforeEach(() => {
    received = [];
    listener = (e) => received.push(e);
    window.addEventListener(SECURITY_BANNER_EVENT, listener);
  });

  afterEach(() => {
    window.removeEventListener(SECURITY_BANNER_EVENT, listener);
  });

  it("dispatches exactly one CustomEvent for a valid string and returns true", () => {
    const result = showSecurityBanner("blocked");

    expect(result).toBe(true);
    expect(received).toHaveLength(1);

    const [event] = received;
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe(SECURITY_BANNER_EVENT);
    expect(event.detail).toEqual({ message: "blocked" });
  });

  it("dispatches exactly one event per call (no duplicates)", () => {
    showSecurityBanner("one");
    showSecurityBanner("two");

    expect(received).toHaveLength(2);
    expect(received[0].detail.message).toBe("one");
    expect(received[1].detail.message).toBe("two");
  });

  it("accepts the empty string as a valid string input", () => {
    const result = showSecurityBanner("");

    expect(result).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].detail.message).toBe("");
  });
});

describe("securityBanner channel — non-string inputs rejected (Req 5.4)", () => {
  let listener;
  let count;

  beforeEach(() => {
    count = 0;
    listener = () => {
      count += 1;
    };
    window.addEventListener(SECURITY_BANNER_EVENT, listener);
  });

  afterEach(() => {
    window.removeEventListener(SECURITY_BANNER_EVENT, listener);
  });

  const nonStrings = [
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["object", { message: "hi" }],
    ["array", ["hi"]],
    ["boolean", true],
  ];

  it.each(nonStrings)(
    "rejects %s: returns false and dispatches nothing",
    (_label, value) => {
      const result = showSecurityBanner(value);

      expect(result).toBe(false);
      expect(count).toBe(0);
    }
  );

  it("leaves existing listeners unaffected when input is rejected", () => {
    // A rejected call must not fire the listener at all.
    showSecurityBanner(undefined);
    expect(count).toBe(0);

    // The listener still works for a subsequent valid call.
    const ok = showSecurityBanner("valid");
    expect(ok).toBe(true);
    expect(count).toBe(1);
  });
});

describe("securityBanner channel — no global target (Req 5.5)", () => {
  let originalDispatch;

  afterEach(() => {
    // Always restore the real dispatchEvent so other tests are unaffected.
    if (originalDispatch !== undefined) {
      window.dispatchEvent = originalDispatch;
      originalDispatch = undefined;
    }
    vi.restoreAllMocks();
  });

  it("does not throw and returns false when no dispatchEvent-capable target exists", () => {
    originalDispatch = window.dispatchEvent;
    try {
      // Remove the dispatchEvent capability from the global target so the
      // channel resolves no usable target. globalThis === window in jsdom, so
      // this covers both resolution branches.
      // eslint-disable-next-line no-global-assign
      window.dispatchEvent = undefined;

      let result;
      expect(() => {
        result = showSecurityBanner("no target available");
      }).not.toThrow();

      expect(result).toBe(false);
    } finally {
      window.dispatchEvent = originalDispatch;
      originalDispatch = undefined;
    }
  });

  it("restores normal dispatch behavior after the stub is removed", () => {
    const received = [];
    const listener = (e) => received.push(e);
    window.addEventListener(SECURITY_BANNER_EVENT, listener);
    try {
      const result = showSecurityBanner("after restore");
      expect(result).toBe(true);
      expect(received).toHaveLength(1);
    } finally {
      window.removeEventListener(SECURITY_BANNER_EVENT, listener);
    }
  });
});
