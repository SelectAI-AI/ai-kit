// Integration test for the Razorpay Standard Checkout flow (src/lib/checkout.js).
// Framework: Vitest (globals) + jsdom.
// Covers Requirement 6.1: when the frontend receives a Razorpay order id and
// key id, the platform opens Razorpay Standard Checkout configured for that
// order in INR.
//
// Strategy:
//   - The `../api` axios singleton is mocked so POST /api/payments/order
//     resolves with a server-authoritative order
//     ({ razorpay_order_id, amount_paise, currency: "INR", key_id }) and
//     POST /api/payments/callback resolves { verified: true }.
//   - The Razorpay Standard Checkout script is mocked via options.loadScript,
//     which resolves to a fake Razorpay constructor. The fake records the
//     options object it was constructed with and exposes an open() spy. This
//     avoids hitting the real CDN while letting us assert exactly how Checkout
//     was configured (INR, order id, key id, amount) and that it was opened.

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---- Mock the API client -------------------------------------------------
// checkout.js calls api.post("/api/payments/order", ...) and
// api.post("/api/payments/callback", ...). Route both to fixtures.
const { mockApi } = vi.hoisted(() => ({
  mockApi: { post: vi.fn() },
}));
vi.mock("../api", () => ({ default: mockApi }));

import { startCheckout } from "./checkout.js";

// Server-authoritative order the mocked backend returns. currency is INR and
// the key id / order id are the values Checkout must be opened with (Req 6.1).
const ORDER = {
  razorpay_order_id: "order_test123",
  amount_paise: 999900,
  currency: "INR",
  key_id: "rzp_test_key",
};

// A verified Checkout callback payload the fake Razorpay hands to the handler.
const CALLBACK = {
  razorpay_order_id: "order_test123",
  razorpay_payment_id: "pay_test456",
  razorpay_signature: "sig_test789",
};

// Build a fake Razorpay constructor that records the options passed to it and
// exposes an open() spy. open() synchronously invokes the success handler with
// the verified callback payload, simulating a completed Standard Checkout.
function makeFakeRazorpay() {
  const calls = { options: null, openCount: 0 };
  function FakeRazorpay(options) {
    calls.options = options;
    this.open = vi.fn(() => {
      calls.openCount += 1;
      // Simulate Razorpay invoking the success handler.
      options.handler(CALLBACK);
    });
  }
  return { FakeRazorpay, calls };
}

function wireApi() {
  mockApi.post.mockImplementation((url) => {
    if (url === "/api/payments/order") {
      return Promise.resolve({ data: ORDER });
    }
    if (url === "/api/payments/callback") {
      return Promise.resolve({ data: { verified: true } });
    }
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
}

describe("startCheckout — Standard Checkout opens in INR (Req 6.1)", () => {
  beforeEach(() => {
    mockApi.post.mockReset();
  });

  it("opens Razorpay Checkout in INR with the returned order id and key id", async () => {
    wireApi();
    const { FakeRazorpay, calls } = makeFakeRazorpay();

    const result = await startCheckout("kit1", {
      loadScript: () => Promise.resolve(FakeRazorpay),
    });

    // The order was fetched from the backend (server-authoritative).
    expect(mockApi.post).toHaveBeenCalledWith("/api/payments/order", {
      selection: "kit1",
    });

    // The Razorpay constructor received INR, the returned order id, key id,
    // and the server-authoritative amount (Req 6.1).
    expect(calls.options).toBeTruthy();
    expect(calls.options.currency).toBe("INR");
    expect(calls.options.order_id).toBe("order_test123");
    expect(calls.options.key).toBe("rzp_test_key");
    expect(calls.options.amount).toBe(999900);

    // Checkout was opened exactly once.
    expect(calls.openCount).toBe(1);

    // Triggering the handler posts the callback to /api/payments/callback.
    expect(mockApi.post).toHaveBeenCalledWith("/api/payments/callback", {
      razorpay_order_id: "order_test123",
      razorpay_payment_id: "pay_test456",
      razorpay_signature: "sig_test789",
    });

    // The flow resolves with the order, callback, and backend confirmation.
    expect(result.order).toEqual(ORDER);
    expect(result.callback).toEqual(CALLBACK);
    expect(result.confirmation).toEqual({ verified: true });
  });

  it("passes the loadScript mock instead of hitting the real CDN", async () => {
    wireApi();
    const { FakeRazorpay, calls } = makeFakeRazorpay();
    const loadScript = vi.fn(() => Promise.resolve(FakeRazorpay));

    await startCheckout("kit1", { loadScript });

    // The injected loader was used (no real script injection occurred).
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(calls.openCount).toBe(1);
  });
});
