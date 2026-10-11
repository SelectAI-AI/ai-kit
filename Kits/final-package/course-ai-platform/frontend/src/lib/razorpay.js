// Razorpay Standard Checkout script loader.
//
// Dynamically injects the Razorpay Standard Checkout script and resolves once
// `window.Razorpay` is available. Kept small and side-effect-isolated so it can
// be mocked in tests (the integration test for the checkout flow stubs this
// module rather than hitting the real CDN).

/** URL of the Razorpay Standard Checkout script. @type {string} */
export const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Ensure the Razorpay Standard Checkout script is loaded and
 * `window.Razorpay` is available.
 *
 * The returned promise resolves with the `window.Razorpay` constructor. If the
 * script (or constructor) is already present, it resolves immediately without
 * injecting a second `<script>` tag. If a script tag with the checkout src is
 * already in the document (e.g. a load is already in flight), its load/error
 * events are reused rather than adding another tag.
 *
 * @returns {Promise<any>} Resolves with the `window.Razorpay` constructor.
 * @throws {Error} When the script fails to load or the environment has no DOM.
 */
export function loadRazorpayCheckout() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout requires a browser environment"));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  return new Promise((resolve, reject) => {
    const onLoad = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        reject(new Error("Razorpay Checkout script loaded but window.Razorpay is undefined"));
      }
    };
    const onError = () => reject(new Error("Failed to load Razorpay Checkout script"));

    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.body.appendChild(script);
  });
}
