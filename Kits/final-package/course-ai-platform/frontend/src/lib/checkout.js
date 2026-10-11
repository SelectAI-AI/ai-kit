// Razorpay Standard Checkout flow for the kit-pricing-and-payments feature.
//
// Orchestrates the client side of a purchase:
//   1. POST /api/payments/order {selection} -> server-authoritative order
//      ({ razorpay_order_id, amount_paise, currency: "INR", key_id }).
//   2. Load the Razorpay Standard Checkout script (mockable loader).
//   3. Open checkout in INR with the returned key_id and order id.
//   4. On the success handler, POST the callback to /api/payments/callback.
//
// All HTTP goes through the `api` axios singleton (never raw fetch). The
// Razorpay script loader is injected so tests can mock it.

import api from "../api.js";
import { loadRazorpayCheckout } from "./razorpay.js";

/**
 * @typedef {Object} OrderResponse
 * @property {string} razorpay_order_id - The Razorpay order identifier.
 * @property {number} amount_paise - Server-authoritative amount in integer paise.
 * @property {string} currency - Always "INR".
 * @property {string} key_id - The Razorpay key id used to open Checkout.
 */

/**
 * @typedef {Object} CheckoutCallback
 * @property {string} razorpay_order_id
 * @property {string} razorpay_payment_id
 * @property {string} razorpay_signature
 */

/**
 * @typedef {Object} StartCheckoutOptions
 * @property {() => Promise<any>} [loadScript] - Loader resolving to the
 *   `window.Razorpay` constructor. Defaults to {@link loadRazorpayCheckout};
 *   override in tests to mock the script.
 * @property {string} [name] - Checkout display name (business/brand).
 * @property {string} [description] - Checkout description line.
 * @property {Record<string, string>} [prefill] - Prefilled customer fields.
 */

/**
 * @typedef {Object} StartCheckoutResult
 * @property {OrderResponse} order - The order returned by the backend.
 * @property {CheckoutCallback} callback - The verified Checkout callback payload.
 * @property {any} confirmation - The parsed body of the callback confirmation.
 */

/**
 * Fetch a server-authoritative order for `selection`.
 *
 * @param {string} selection - A sellable kit id or "bundle".
 * @returns {Promise<OrderResponse>} The created order details.
 */
export async function createOrder(selection) {
  const { data } = await api.post("/api/payments/order", { selection });
  return data;
}

/**
 * Post a Razorpay Standard Checkout callback to the backend for signature
 * verification and server-side payment confirmation.
 *
 * @param {CheckoutCallback} callback - The success payload from Checkout.
 * @returns {Promise<any>} The confirmation response body.
 */
export async function postCallback(callback) {
  const { data } = await api.post("/api/payments/callback", {
    razorpay_order_id: callback.razorpay_order_id,
    razorpay_payment_id: callback.razorpay_payment_id,
    razorpay_signature: callback.razorpay_signature,
  });
  return data;
}

/**
 * Build the Razorpay Standard Checkout options object for an order.
 *
 * Exposed separately so tests can assert the INR configuration, order id, and
 * key id without opening a real Checkout instance.
 *
 * @param {OrderResponse} order - The order returned by the backend.
 * @param {(callback: CheckoutCallback) => void} handler - Success handler.
 * @param {StartCheckoutOptions} [options] - Display overrides.
 * @returns {Record<string, any>} The Checkout options.
 */
export function buildCheckoutOptions(order, handler, options = {}) {
  return {
    key: order.key_id,
    order_id: order.razorpay_order_id,
    amount: order.amount_paise,
    currency: "INR",
    name: options.name || "Course AI Platform",
    description: options.description || `Purchase: ${order.razorpay_order_id}`,
    prefill: options.prefill || {},
    handler,
  };
}

/**
 * Run the full Standard Checkout flow for a selection.
 *
 * Fetches an order, loads the Checkout script, opens Checkout in INR with the
 * returned key id, and resolves once the success handler fires and the callback
 * has been confirmed by the backend. Rejects if the order cannot be created,
 * the script fails to load, or the user dismisses Checkout.
 *
 * @param {string} selection - A sellable kit id or "bundle".
 * @param {StartCheckoutOptions} [options] - Loader and display overrides.
 * @returns {Promise<StartCheckoutResult>} Resolves after the callback is posted.
 */
export async function startCheckout(selection, options = {}) {
  const loadScript = options.loadScript || loadRazorpayCheckout;

  const order = await createOrder(selection);
  const Razorpay = await loadScript();

  return new Promise((resolve, reject) => {
    const handler = (response) => {
      const callback = {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      };
      postCallback(callback)
        .then((confirmation) => resolve({ order, callback, confirmation }))
        .catch(reject);
    };

    const checkoutOptions = buildCheckoutOptions(order, handler, options);
    checkoutOptions.modal = {
      ondismiss: () => reject(new Error("Checkout dismissed")),
    };

    const rzp = new Razorpay(checkoutOptions);
    rzp.open();
  });
}
