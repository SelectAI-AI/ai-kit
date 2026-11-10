import React, { useEffect, useState } from "react"; // eslint-disable-line no-unused-vars
import { useLocation } from "react-router-dom";
import api from "../api";
import { CURRENCY_OPTIONS, formatMinor, pickCurrency } from "../lib/pricing";
import { startCheckout } from "../lib/checkout";
import { ArrowRight, Info, Lock } from "lucide-react";

// Public pricing page (Req 11), laid out like the selectAi pricing page: a
// currency selector, a navy hero with the bundle price, and a product/price
// table with an Enroll Now button. Every price comes from the catalog API
// (GET /api/pricing/catalog) in the selected currency (Req 11.5). Non-purchasable
// kits render without a buy action (Req 11.4). Styling is Tailwind utilities only.

// Marketing copy from the selectAi pricing page; the catalog does not carry it.
const LABS_COUNT = 35;
const CURRENCY_KEY = "currency";
// Mirrors TIER_PERCENT_OFF["student_t1"] in backend/app/pricing_service.py.
const STUDENT_DISCOUNT_PERCENT = 35;

// Catalog responses from before multi-currency only carry INR in the legacy
// `*_paise` fields, so fall back to those when the `prices` maps are absent.
const kitPrice = (kit, currency) =>
  kit.prices?.[currency] ?? (currency === "INR" ? kit.base_price_paise : undefined);
const bundlePrice = (catalog, currency) =>
  catalog.bundle_prices?.[currency] ?? (currency === "INR" ? catalog.bundle_base_paise : undefined);

// "kit3" -> "Kit 3"
const kitNumber = (kitId) => {
  const digits = kitId.replace(/\D/g, "");
  return digits ? `Kit ${digits}` : "Kit";
};

export default function Pricing() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [buying, setBuying] = useState("");
  const [currency, setCurrency] = useState("");
  const location = useLocation();

  // A denied gated module view directs the user here with ?kit=<required_kit_id>
  // so the required kit can be highlighted (Req 9.2).
  const requiredKitId = new URLSearchParams(location.search).get("kit") || "";

  useEffect(() => {
    api.get("/api/pricing/catalog")
      .then(({ data }) => {
        setCatalog(data);
        const offered = data.currencies?.length ? data.currencies : ["INR"];
        setCurrency(pickCurrency(offered, localStorage.getItem(CURRENCY_KEY)));
      })
      .catch(() => setError("Could not load pricing. Is the backend running?"));
  }, []);

  const chooseCurrency = (code) => {
    setCurrency(code);
    localStorage.setItem(CURRENCY_KEY, code);
  };

  // Open Razorpay Standard Checkout for a selection via the checkout flow
  // (lib/checkout.js), which fetches a server-authoritative order in the chosen
  // currency and opens Checkout with the returned key id.
  const buy = async (selection) => {
    setCheckoutError("");
    setBuying(selection);
    try {
      await startCheckout(selection, { currency });
    } catch (err) {
      setCheckoutError(err?.response?.data?.detail || err?.message || "Checkout could not be completed.");
    } finally {
      setBuying("");
    }
  };

  const offeredCurrencies = catalog?.currencies?.length ? catalog.currencies : ["INR"];
  const sellableKits = catalog?.kits?.filter((k) => k.purchasable) ?? [];
  const otherKits = catalog?.kits?.filter((k) => !k.purchasable) ?? [];
  const moduleCount = new Set(sellableKits.flatMap((k) => k.slugs)).size;
  const bundleMinor = catalog ? bundlePrice(catalog, currency) : undefined;
  const bundleText = bundleMinor === undefined ? "" : formatMinor(bundleMinor, currency);

  return (
    <div>
      {requiredKitId && (
        <p className="mb-6 rounded-lg border border-brass-500/40 bg-brass-500/10 px-4 py-2.5 text-sm text-brass-300">
          That module is locked. Buy the highlighted kit below to unlock it.
        </p>
      )}

      {error && <p className="text-rust-400 text-sm">{error}</p>}
      {checkoutError && <p className="text-rust-400 text-sm mb-4">{checkoutError}</p>}

      {catalog && (
        <>
          {/* Currency selector */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-white px-4 py-3 shadow-sm">
            <label className="flex items-center gap-3 text-sm font-display text-paper-300">
              <span className="font-semibold">Currency</span>
              <select
                value={currency}
                onChange={(e) => chooseCurrency(e.target.value)}
                className="rounded-lg border border-brass-500/40 bg-ink-800 px-3 py-1.5 text-sm font-semibold text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                {offeredCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_OPTIONS.find((o) => o.code === code)?.label ?? code}
                  </option>
                ))}
              </select>
            </label>
            <p className="flex items-center gap-2 rounded-lg bg-cyan-50 px-3 py-1.5 text-sm text-paper-300">
              <Info size={14} aria-hidden="true" /> Prices shown in your selected currency.
            </p>
          </div>

          {/* Hero: the bundle price */}
          <section className="mb-5 rounded-3xl bg-[#190a52] px-6 py-10 text-center text-white">
            <p className="text-sm text-white/60">Applied AI Engineering Program</p>
            {bundleText && (
              <p className="mt-3 flex items-baseline justify-center gap-2 font-brand font-black">
                <span className="text-3xl">{bundleText.charAt(0)}</span>
                <span className="text-6xl">{bundleText.slice(1)}</span>
                <span className="text-xl font-semibold text-white/50">{currency}</span>
              </p>
            )}
            <p className="mt-4 text-sm font-semibold text-white/90">One-time payment • No launch discounts</p>
            <p className="mt-1 text-sm text-white/50">
              {sellableKits.length} Kits • {moduleCount} Modules • {LABS_COUNT} Hands-on Labs
            </p>
          </section>

          {/* Product / price table */}
          <section className="overflow-hidden rounded-2xl border border-ink-700 bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_auto_5rem] items-center gap-4 bg-ink-800/70 px-6 py-3 font-brand text-xs font-bold uppercase tracking-widest">
              <span className="text-teal-400">Product</span>
              <span className="text-paper-100 text-right">Price</span>
              <span aria-hidden="true" />
            </div>

            {sellableKits.map((kit) => {
              const minor = kitPrice(kit, currency);
              const highlighted = kit.kit_id === requiredKitId;
              return (
                <div
                  key={kit.kit_id}
                  data-required={highlighted ? "true" : undefined}
                  className={`grid grid-cols-[1fr_auto_5rem] items-center gap-4 border-t border-ink-700 px-6 py-4 ${
                    highlighted ? "bg-brass-500/10 ring-1 ring-inset ring-brass-500/50" : ""
                  }`}
                >
                  <div>
                    <p className="text-paper-100">
                      <span>{kitNumber(kit.kit_id)} — </span>
                      <span>{kit.name}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-paper-400">
                      {kit.slugs.map((slug) => (
                        <span key={slug}>{slug}</span>
                      ))}
                    </p>
                  </div>
                  <span className="font-brand text-lg font-bold text-paper-100 text-right">
                    {minor === undefined ? "—" : formatMinor(minor, currency)}
                  </span>
                  {minor === undefined ? (
                    <span className="text-xs text-paper-400">n/a in {currency}</span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`buy-${kit.kit_id}`}
                      disabled={buying === kit.kit_id}
                      onClick={() => buy(kit.kit_id)}
                      aria-label={`Buy ${kit.name}`}
                      className="rounded-lg border border-brass-500 px-3 py-1.5 text-xs font-semibold text-brass-400 transition-colors hover:bg-brass-500/10 disabled:opacity-50"
                    >
                      {buying === kit.kit_id ? "Opening…" : "Buy"}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Bundle row */}
            <div className="grid grid-cols-[1fr_auto_5rem] items-center gap-4 border-t border-ink-700 bg-ink-800/70 px-6 py-4">
              <p className="font-bold text-paper-100">Complete {sellableKits.length}-Kit Bundle</p>
              <span className="font-brand text-lg font-black text-gradient text-right">{bundleText || "—"}</span>
              <span aria-hidden="true" />
            </div>
          </section>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              data-testid="buy-bundle"
              disabled={buying === "bundle" || bundleMinor === undefined}
              onClick={() => buy("bundle")}
              className="btn-brand inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-display"
            >
              {buying === "bundle" ? "Opening checkout…" : "Enroll Now"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Student discount: one rate, with who qualifies and how it is granted. */}
          <section
            data-testid="student-discount"
            className="mx-auto mt-8 max-w-xl rounded-2xl border border-ink-700 bg-white px-5 py-4 text-center shadow-sm"
          >
            <h2 className="font-display text-sm font-semibold text-paper-100">
              Student discount: {STUDENT_DISCOUNT_PERCENT}% off individual kits
            </h2>
            <p className="mt-1 text-sm text-paper-400">
              Available to students once an admin approves your student details, such as your
              university. The discount is applied automatically at checkout. It does not apply to
              the bundle.
            </p>
          </section>

          {/* Non-purchasable kits render WITHOUT a buy action (Req 11.4) */}
          {otherKits.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-paper-100 text-sm mb-3">Coming soon</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {otherKits.map((kit) => (
                  <div
                    key={kit.kit_id}
                    className="rounded-xl border border-dashed border-ink-600 bg-white/50 p-5"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-display text-paper-300">{kit.name}</h3>
                      <span className="flex items-center gap-1 text-paper-600 text-xs font-display">
                        <Lock size={12} /> not available
                      </span>
                    </div>
                    <p className="text-paper-600 text-sm">
                      This kit isn&apos;t available for purchase yet.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
