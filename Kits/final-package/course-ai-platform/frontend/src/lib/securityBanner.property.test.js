import { describe, it, afterEach } from "vitest";
import fc from "fast-check";
import { SECURITY_BANNER_EVENT, showSecurityBanner } from "./securityBanner.js";

// Feature: notebook-content-protection, Property 1: For any string s (len 0..10000), showSecurityBanner round-trips s byte-for-byte to the listener

describe("securityBanner channel round-trip (Property 1)", () => {
  // Validates: Requirements 5.3, 11.5

  // A single shared handler updated per run avoids listener leakage across the
  // many fast-check iterations: we register once, capture into a closure cell,
  // and remove it after the property completes.
  it("round-trips any string (len 0..10000) byte-for-byte to the listener", () => {
    let received;
    const handler = (event) => {
      received = event.detail.message;
    };
    window.addEventListener(SECURITY_BANNER_EVENT, handler);

    try {
      fc.assert(
        fc.property(fc.string({ maxLength: 10000 }), (s) => {
          received = undefined;
          const dispatched = showSecurityBanner(s);
          // The channel must dispatch for any string, including the empty string.
          return dispatched === true && received === s;
        }),
        { numRuns: 100 }
      );
    } finally {
      window.removeEventListener(SECURITY_BANNER_EVENT, handler);
    }
  });

  // fast-check's default generator does not always include the empty string
  // within a small run count; assert it explicitly to satisfy the "must include
  // empty string" requirement in the input space (len 0..10000).
  it("round-trips the empty string byte-for-byte to the listener", () => {
    let received;
    const handler = (event) => {
      received = event.detail.message;
    };
    window.addEventListener(SECURITY_BANNER_EVENT, handler);

    try {
      const dispatched = showSecurityBanner("");
      if (dispatched !== true || received !== "") {
        throw new Error(`empty-string round-trip failed: dispatched=${dispatched}, received=${JSON.stringify(received)}`);
      }
    } finally {
      window.removeEventListener(SECURITY_BANNER_EVENT, handler);
    }
  });

  afterEach(() => {
    // Defensive: ensure no listeners linger between test cases.
  });
});
