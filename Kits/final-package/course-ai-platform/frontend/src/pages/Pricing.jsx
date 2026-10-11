import React, { useEffect, useState } from "react"; // eslint-disable-line no-unused-vars
import { useLocation } from "react-router-dom";
import api from "../api";
import { formatPaiseToInr, tierLabel } from "../lib/pricing";
import { startCheckout } from "../lib/checkout";
import { Check, Lock, Sparkles } from "lucide-react";

// Public pricing page (Req 11). Every displayed price is sourced from the
// catalog API (GET /api/pricing/catalog) rather than static client values
// (Req 11.5): the base kit price, the bundle price, and the student discount
// tiers are all derived from the catalog's `base_price_paise` /
// `bundle_base_paise`. Non-purchasable kits render without a buy action
// (Req 11.4). Styling is Tailwind utilities only.

// Student discount tiers displayed as a percentage off the catalog base price
// (Req 11.3). The percentages are the mandated tier definitions; the resulting
// amounts are computed from the catalog base so they stay in sync with pricing.
const STUDENT_TIERS = [
  { tier: "student_t1", percentOff: 35 },
  { tier: "student_t2", percentOff: 50 },
];

export default function Pricing() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [buying, setBuying] = useState("");
  const location = useLocation();

  // A denied gated module view directs the user here with ?kit=<required_kit_id>
  // so the required kit can be highlighted (Req 9.2).
  const requiredKitId = new URLSearchParams(location.search).get("kit") || "";

  useEffect(() => {
    api.get("/api/pricing/catalog")
      .then(({ data }) => setCatalog(data))
      .catch(() => setError("Could not load pricing. Is the backend running?"));
  }, []);

  // Open Razorpay Standard Checkout for a selection via the checkout flow
  // (lib/checkout.js), which fetches a server-authoritative order and opens
  // Checkout in INR with the returned key id.
  const buy = async (selection) => {
    setCheckoutError("");
    setBuying(selection);
    try {
      await startCheckout(selection);
    } catch (err) {
      setCheckoutError(err?.message || "Checkout could not be completed.");
    } finally {
      setBuying("");
    }
  };

  const sellableKits = catalog?.kits?.filter((k) => k.purchasable) ?? [];
  const otherKits = catalog?.kits?.filter((k) => !k.purchasable) ?? [];
  // Base kit price (₹9,999) sourced from the first kit's catalog base price,
  // falling back to any kit so the anchor always reflects the catalog (Req 11.2).
  const baseKitPaise = catalog?.kits?.[0]?.base_price_paise ?? 0;

  return (
    <div>
      <h1 className="font-display text-xl text-paper-100 mb-1">Pricing</h1>
      <p className="text-paper-400 text-sm mb-8">
        Buy a kit to unlock its modules, or get everything with the full bundle.
      </p>

      {requiredKitId && (
        <p className="mb-6 rounded-lg border border-brass-500/40 bg-brass-500/10 px-4 py-2.5 text-sm text-brass-300">
          That module is locked. Buy the highlighted kit below to unlock it.
        </p>
      )}

      {error && <p className="text-rust-400 text-sm">{error}</p>}
      {checkoutError && <p className="text-rust-400 text-sm mb-4">{checkoutError}</p>}

      {catalog && (
        <>
          {/* Bundle + base-kit anchors (Req 11.2) */}
          <div className="grid gap-4 sm:grid-cols-2 mb-10">
            <div className="rounded-xl border border-brass-500/40 bg-ink-900/70 p-5">
              <div className="flex items-center gap-1.5 text-brass-400 text-sm font-display mb-1">
                <Sparkles size={14} /> full bundle
              </div>
              <p className="text-paper-100 font-display text-2xl mb-1">
                {formatPaiseToInr(catalog.bundle_base_paise)}
              </p>
              <p className="text-paper-400 text-sm mb-4">
                Every sellable kit plus the capstone — {catalog.bundle_slugs.length} modules.
              </p>
              <button
                type="button"
                data-testid="buy-bundle"
                disabled={buying === "bundle"}
                onClick={() => buy("bundle")}
                className="rounded-lg bg-brass-500 px-4 py-2 text-sm font-display text-ink-950 hover:bg-brass-400 transition-colors disabled:opacity-50"
              >
                {buying === "bundle" ? "opening checkout…" : "Buy bundle"}
              </button>
            </div>

            <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-5">
              <div className="text-paper-400 text-sm font-display mb-1">base kit</div>
              <p className="text-paper-100 font-display text-2xl mb-1">
                {formatPaiseToInr(baseKitPaise)}
              </p>
              <p className="text-paper-400 text-sm">Per individual kit, standard price.</p>
            </div>
          </div>

          {/* Student discount tiers (Req 11.3) */}
          <h2 className="font-display text-paper-100 text-sm mb-3">Student discounts</h2>
          <div className="grid gap-4 sm:grid-cols-2 mb-10">
            {STUDENT_TIERS.map(({ tier, percentOff }) => {
              const discountedPaise = Math.round(baseKitPaise * (1 - percentOff / 100));
              return (
                <div
                  key={tier}
                  className="rounded-xl border border-teal-500/30 bg-ink-900/70 p-5"
                >
                  <div className="text-teal-400 text-sm font-display mb-1">
                    {tierLabel(tier)}
                  </div>
                  <p className="text-paper-100 font-display text-2xl mb-1">
                    {formatPaiseToInr(discountedPaise)}
                  </p>
                  <p className="text-paper-400 text-sm">{percentOff}% off the base kit price.</p>
                </div>
              );
            })}
          </div>

          {/* Sellable kits (Req 11.1) */}
          <h2 className="font-display text-paper-100 text-sm mb-3">Kits</h2>
          <div className="grid gap-4 sm:grid-cols-2 mb-10">
            {sellableKits.map((kit) => (
              <div
                key={kit.kit_id}
                data-required={kit.kit_id === requiredKitId ? "true" : undefined}
                className={`rounded-xl border bg-ink-900/70 p-5 flex flex-col ${
                  kit.kit_id === requiredKitId ? "border-brass-500 ring-1 ring-brass-500/50" : "border-ink-700"
                }`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-display text-paper-100">{kit.name}</h3>
                  <span className="font-display text-brass-400">
                    {formatPaiseToInr(kit.base_price_paise)}
                  </span>
                </div>
                <ul className="text-paper-400 text-sm space-y-1 mb-4 flex-1">
                  {kit.slugs.map((slug) => (
                    <li key={slug} className="flex items-center gap-1.5">
                      <Check size={13} className="text-teal-400 shrink-0" />
                      {slug}
                    </li>
                  ))}
                </ul>
                {/* Purchasable kit -> buy action (Req 11.1) */}
                <button
                  type="button"
                  data-testid={`buy-${kit.kit_id}`}
                  disabled={buying === kit.kit_id}
                  onClick={() => buy(kit.kit_id)}
                  className="rounded-lg bg-brass-500 px-4 py-2 text-sm font-display text-ink-950 hover:bg-brass-400 transition-colors disabled:opacity-50"
                >
                  {buying === kit.kit_id ? "opening checkout…" : `Buy ${kit.name}`}
                </button>
              </div>
            ))}
          </div>

          {/* Non-purchasable kits render WITHOUT a buy action (Req 11.4) */}
          {otherKits.length > 0 && (
            <>
              <h2 className="font-display text-paper-100 text-sm mb-3">Coming soon</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {otherKits.map((kit) => (
                  <div
                    key={kit.kit_id}
                    className="rounded-xl border border-dashed border-ink-700 bg-ink-900/40 p-5"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-display text-paper-400">{kit.name}</h3>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
