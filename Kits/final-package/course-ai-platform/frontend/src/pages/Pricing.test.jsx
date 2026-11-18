// UI tests for the public pricing page (src/pages/Pricing.jsx).
// Framework: Vitest (globals) + @testing-library/react + jsdom.
// Covers Requirements 11.1, 11.4, 11.5.
//
// The `../api` axios singleton is mocked so GET /api/pricing/catalog resolves
// with a fixture catalog. The catalog is the single source of truth for every
// displayed price (Req 11.5): the fixture contains one purchasable kit (slugs
// non-empty) and one non-purchasable kit (slugs empty, purchasable: false),
// plus bundle_slugs and bundle_base_paise. The tests assert that:
//   - a sellable kit renders its name, its module slugs, and its formatted
//     base price, and exposes a buy action (data-testid=`buy-{kit_id}`) (11.1)
//   - a non-purchasable kit renders its name but NO buy action (11.4)
//   - the rendered prices are the ones from the mocked API (11.5)

import React from "react"; // eslint-disable-line no-unused-vars
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { formatPaiseToInr } from "../lib/pricing";

// Pricing uses useLocation() (to read ?kit=), so it must render inside a
// Router context. Wrap it in MemoryRouter for every render.
// The login route shows where the visitor will be sent back to after signing in.
function LoginProbe() {
  const location = useLocation();
  return <div data-testid="login-page">login from={location.state?.from}</div>;
}

function renderPricing(path = "/pricing") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

// ---- Mock the API client -------------------------------------------------
// Pricing only calls api.get("/api/pricing/catalog"); route it to the fixture.
const { mockApi, mockStartCheckout, mockAuth } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn() },
  mockStartCheckout: vi.fn(),
  mockAuth: { user: null, loading: false },
}));
vi.mock("../api", () => ({ default: mockApi }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
vi.mock("../lib/checkout", () => ({ startCheckout: mockStartCheckout }));

import Pricing from "./Pricing.jsx";

// Fixture catalog mirroring the backend CatalogOut shape. Prices are distinct,
// non-anchor values so an assertion that they appear proves they came from the
// mocked API rather than any hardcoded client constant (Req 11.5).
const PURCHASABLE_KIT = {
  kit_id: "kit1",
  name: "Foundations Kit",
  slugs: ["fundamentals", "db", "rag-engineering"],
  base_price_paise: 888800, // ₹8,888 — deliberately not a catalog anchor
  purchasable: true,
};

const NON_PURCHASABLE_KIT = {
  kit_id: "kit5",
  name: "Fine-Tuning Kit",
  slugs: [],
  base_price_paise: 999900,
  purchasable: false,
};

function makeCatalog(overrides = {}) {
  return {
    kits: [PURCHASABLE_KIT, NON_PURCHASABLE_KIT],
    bundle_slugs: ["fundamentals", "db", "rag-engineering", "capstone"],
    bundle_base_paise: 2777700, // ₹27,777 — distinct, non-anchor
    ...overrides,
  };
}


// The real catalog shape for India with the launch coupon switched on, and the offer
// the server returns for LAUNCHOFFER (₹2,999 per kit, ₹9,996 bundle).
const COUPON_CATALOG = {
  kits: [
    { kit_id: "kit1", name: "Foundations Kit", slugs: ["fundamentals", "db"], base_price_paise: 999900,
      purchasable: true, prices: { INR: 999900, USD: 6900 } },
    { kit_id: "kit2", name: "Agents Kit", slugs: ["agentic-ai"], base_price_paise: 999900,
      purchasable: true, prices: { INR: 999900, USD: 7900 } },
  ],
  bundle_slugs: ["fundamentals", "db", "agentic-ai", "capstone"],
  bundle_base_paise: 3999600,
  bundle_prices: { INR: 3999600, USD: 19900 },
  currencies: ["INR", "USD"],
  default_currency: "INR",
  coupons_enabled: true,
};
const OFFER = {
  code: "LAUNCHOFFER",
  label: "Early bird / Launching offer",
  currency: "INR",
  prices: { kit1: 299900, kit2: 299900, bundle: 999600 },
  percent_off: { kit1: 70, kit2: 70, bundle: 75 },
};

function wireCatalog(catalog = makeCatalog()) {
  mockApi.get.mockImplementation((url) => {
    if (url === "/api/pricing/catalog") {
      return Promise.resolve({ data: catalog });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe("Pricing page", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    mockStartCheckout.mockReset();
    localStorage.clear();
    mockAuth.user = { id: "u1", role: "student" }; // signed in unless a test says otherwise
    mockAuth.loading = false;
  });

  // ---- Req 11.5: catalog is fetched from the API ------------------------
  it("sources the catalog from GET /api/pricing/catalog via the api singleton", async () => {
    wireCatalog();
    renderPricing();

    // The sellable kit name confirms the catalog resolved and rendered.
    await screen.findByText(PURCHASABLE_KIT.name);
    expect(mockApi.get).toHaveBeenCalledWith("/api/pricing/catalog");
  });

  // ---- Req 11.1: sellable kit renders name, modules, price, buy action ---
  it("renders a sellable kit's name, module slugs, formatted base price, and a buy action (11.1)", async () => {
    wireCatalog();
    renderPricing();

    // Name.
    await screen.findByText(PURCHASABLE_KIT.name);

    // The buy action for this kit exists (data-testid=`buy-{kit_id}`).
    const buyBtn = screen.getByTestId(`buy-${PURCHASABLE_KIT.kit_id}`);
    expect(buyBtn).toBeInTheDocument();

    // Scope the remaining assertions to the kit's own card so the kit's name,
    // slugs, and price are verified where the buy action lives (and not matched
    // against the separate "base kit" anchor, which reuses the first kit's
    // base price). The card is the nearest ancestor containing the buy button.
    const card = buyBtn.closest("div");
    const cardScope = within(card);

    // Name rendered within the kit card.
    expect(cardScope.getByText(PURCHASABLE_KIT.name)).toBeInTheDocument();

    // Each covered module slug is rendered within the kit card.
    for (const slug of PURCHASABLE_KIT.slugs) {
      expect(cardScope.getByText(slug)).toBeInTheDocument();
    }

    // The kit's formatted base price (from the mocked API) is rendered inside
    // the card (Req 11.1/11.5).
    const expectedPrice = formatPaiseToInr(PURCHASABLE_KIT.base_price_paise); // "₹8,888"
    expect(cardScope.getByText(expectedPrice)).toBeInTheDocument();
  });

  // ---- Req 11.4: non-purchasable kit renders without a buy action --------
  it("renders a non-purchasable kit's name but no buy action for it (11.4)", async () => {
    wireCatalog();
    renderPricing();

    // The non-purchasable kit name appears.
    expect(await screen.findByText(NON_PURCHASABLE_KIT.name)).toBeInTheDocument();

    // No buy action exists for the non-purchasable kit.
    expect(
      screen.queryByTestId(`buy-${NON_PURCHASABLE_KIT.kit_id}`)
    ).not.toBeInTheDocument();
  });

  // ---- Req 11.5: prices shown are the mocked API values, not static ------
  it("displays the bundle price sourced from the mocked catalog (11.5)", async () => {
    wireCatalog();
    renderPricing();

    await screen.findByText(PURCHASABLE_KIT.name);

    // bundle_base_paise from the fixture drives the bundle anchor.
    const expectedBundle = formatPaiseToInr(makeCatalog().bundle_base_paise); // "₹27,777"
    expect(screen.getByText(expectedBundle)).toBeInTheDocument();
  });

  // ---- Req 11.1/11.4: exactly one buy action per sellable kit ------------
  it("exposes a buy action only for purchasable kits (11.1, 11.4)", async () => {
    wireCatalog();
    const { container } = renderPricing();

    await screen.findByText(PURCHASABLE_KIT.name);

    // There is exactly one per-kit buy action and it targets the purchasable
    // kit. The full-bundle anchor (data-testid="buy-bundle") is a separate
    // control, not a per-kit buy action, so it is excluded here (this assertion
    // is scoped to the sellable-kit cards per Req 11.1/11.4).
    const buyButtons = Array.from(
      container.querySelectorAll('[data-testid^="buy-"]')
    ).filter((el) => el.getAttribute("data-testid") !== "buy-bundle");
    expect(buyButtons).toHaveLength(1);
    expect(buyButtons[0].getAttribute("data-testid")).toBe(
      `buy-${PURCHASABLE_KIT.kit_id}`
    );
  });

  // ---- Multi-currency: USD default, selector, and checkout currency -------
  const MULTI_CURRENCY = {
    kits: [
      { ...PURCHASABLE_KIT, prices: { INR: 888800, USD: 6900 } },
      { kit_id: "kit2", name: "Agents Kit", slugs: ["agentic-ai"], base_price_paise: 999900,
        purchasable: true, prices: { INR: 999900, USD: 7900 } },
      NON_PURCHASABLE_KIT,
    ],
    bundle_slugs: ["fundamentals", "agentic-ai", "capstone"],
    bundle_base_paise: 3999900,
    bundle_prices: { INR: 3999900, USD: 19900 },
    currencies: ["INR", "USD"],
    default_currency: "INR",
  };

  it("shows USD prices first when the catalog offers USD, with the hero price and counts", async () => {
    wireCatalog(MULTI_CURRENCY);
    renderPricing();

    await screen.findByText(PURCHASABLE_KIT.name);
    expect(screen.getByLabelText(/currency/i)).toHaveValue("USD");
    expect(screen.getByText("$69")).toBeInTheDocument();
    expect(screen.getByText("$79")).toBeInTheDocument();
    // Hero shows the bundle price split into symbol and number; the table row shows it whole.
    expect(screen.getByText("199")).toBeInTheDocument();
    expect(screen.getByText("$199")).toBeInTheDocument();
    expect(screen.getByText(/2 Kits • 4 Modules • 35 Hands-on Labs/)).toBeInTheDocument();
  });

  it("explains the student discount once: 35%, needs admin approval, no 50% student rate", async () => {
    wireCatalog(MULTI_CURRENCY);
    renderPricing();
    await screen.findByText(PURCHASABLE_KIT.name);

    const note = screen.getByTestId("student-discount");
    expect(note).toHaveTextContent("35% off individual kits");
    expect(note).toHaveTextContent(/admin approves your student details/i);
    expect(note).toHaveTextContent(/university/i);
    expect(note).not.toHaveTextContent("50%");
    // The old combined "35% or 50%" wording is gone from the whole page.
    expect(screen.queryByText(/35% or 50%/)).not.toBeInTheDocument();
  });

  it("switches every price when the currency selector changes and remembers the choice", async () => {
    wireCatalog(MULTI_CURRENCY);
    renderPricing();
    await screen.findByText(PURCHASABLE_KIT.name);

    await userEvent.selectOptions(screen.getByLabelText(/currency/i), "INR");

    expect(screen.getByText(formatPaiseToInr(888800))).toBeInTheDocument();
    expect(screen.getByText(formatPaiseToInr(3999900))).toBeInTheDocument();
    expect(screen.queryByText("$69")).not.toBeInTheDocument();
    expect(localStorage.getItem("currency")).toBe("INR");
  });

  it("starts checkout with the selected currency and never sends an amount", async () => {
    wireCatalog(MULTI_CURRENCY);
    mockStartCheckout.mockResolvedValue({});
    renderPricing();
    await screen.findByText(PURCHASABLE_KIT.name);

    await userEvent.click(screen.getByTestId("buy-kit1"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledTimes(1));
    expect(mockStartCheckout).toHaveBeenCalledWith("kit1", { currency: "USD" });

    await userEvent.click(screen.getByTestId("buy-bundle"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledTimes(2));
    expect(mockStartCheckout).toHaveBeenLastCalledWith("bundle", { currency: "USD" });
  });

  // ---- Signed-out visitors go to the login page, not an error -------------
  describe("buying while signed out", () => {
    beforeEach(() => {
      mockAuth.user = null;
    });

    it("sends a signed-out visitor to the login page when they click Buy", async () => {
      wireCatalog(MULTI_CURRENCY);
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      await userEvent.click(screen.getByTestId("buy-kit1"));

      expect(await screen.findByTestId("login-page")).toHaveTextContent("from=/pricing");
      expect(mockStartCheckout).not.toHaveBeenCalled();
      expect(screen.queryByText(/not authenticated/i)).not.toBeInTheDocument();
    });

    it("does the same for Enroll Now and remembers the page it came from", async () => {
      wireCatalog(MULTI_CURRENCY);
      renderPricing("/pricing?focus=kit1");
      await screen.findByText(PURCHASABLE_KIT.name);

      await userEvent.click(screen.getByTestId("buy-bundle"));

      expect(await screen.findByTestId("login-page")).toHaveTextContent("from=/pricing?focus=kit1");
      expect(mockStartCheckout).not.toHaveBeenCalled();
    });

    it("lets a signed-out visitor browse prices and try a coupon without signing in", async () => {
      wireCatalog(COUPON_CATALOG);
      localStorage.setItem("currency", "INR");
      mockApi.post.mockResolvedValue({ data: OFFER });
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      await userEvent.type(screen.getByTestId("coupon-input"), "launchoffer");
      await userEvent.click(screen.getByTestId("coupon-apply"));

      expect(await screen.findByTestId("coupon-applied")).toBeInTheDocument();
      expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    });
  });

  it("sends a signed-in buyer whose sign-in expired to the login page, with no error text", async () => {
    wireCatalog(MULTI_CURRENCY);
    mockStartCheckout.mockRejectedValue({ response: { status: 401, data: { detail: "Not authenticated" } } });
    renderPricing();
    await screen.findByText(PURCHASABLE_KIT.name);

    await userEvent.click(screen.getByTestId("buy-kit1"));

    expect(await screen.findByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByText(/not authenticated/i)).not.toBeInTheDocument();
  });

  it("still shows a real checkout error to a signed-in buyer", async () => {
    wireCatalog(MULTI_CURRENCY);
    mockStartCheckout.mockRejectedValue({ response: { status: 409, data: { detail: "You already own this kit." } } });
    renderPricing();
    await screen.findByText(PURCHASABLE_KIT.name);

    await userEvent.click(screen.getByTestId("buy-kit1"));

    expect(await screen.findByText("You already own this kit.")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  // ---- LAUNCHOFFER coupon -------------------------------------------------------
  describe("coupon code", () => {
    beforeEach(() => {
      localStorage.setItem("currency", "INR");
      wireCatalog(COUPON_CATALOG);
    });

    it("shows the full prices until a code is applied", async () => {
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      expect(screen.getByTestId("coupon-input")).toBeInTheDocument();
      expect(screen.getAllByText("₹9,999").length).toBeGreaterThan(0);
      expect(screen.getByText("₹39,996")).toBeInTheDocument();
      expect(screen.queryByTestId("list-price-kit1")).not.toBeInTheDocument();
      expect(screen.queryByText("₹2,999")).not.toBeInTheDocument();
    });

    it("strikes off the list prices and shows the offer prices and percentages once the server accepts the code", async () => {
      mockApi.post.mockResolvedValue({ data: OFFER });
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      await userEvent.type(screen.getByTestId("coupon-input"), "LAUNCHOFFER");
      await userEvent.click(screen.getByTestId("coupon-apply"));

      await screen.findByTestId("coupon-applied");
      expect(mockApi.post).toHaveBeenCalledWith("/api/pricing/coupon", { code: "LAUNCHOFFER", currency: "INR" });

      // Kit: list price struck off, offer price and the early bird badge shown.
      expect(screen.getByTestId("list-price-kit1").tagName).toBe("S");
      expect(screen.getByTestId("list-price-kit1")).toHaveTextContent("₹9,999");
      expect(screen.getAllByText("₹2,999").length).toBeGreaterThan(0);
      expect(screen.getByTestId("offer-badge-kit1")).toHaveTextContent("Early bird / Launching offer · 70% off");

      // Bundle: ₹39,996 struck off, ₹9,996 shown, 75% off.
      expect(screen.getByTestId("list-price-bundle").tagName).toBe("S");
      expect(screen.getByTestId("list-price-bundle")).toHaveTextContent("₹39,996");
      expect(screen.getByText("₹9,996")).toBeInTheDocument();
      expect(screen.getByTestId("offer-badge-bundle")).toHaveTextContent("75% off");
      expect(screen.getByTestId("hero-list-price")).toHaveTextContent("₹39,996");
    });

    it("sends the accepted code with the purchase and nothing else about price", async () => {
      mockApi.post.mockResolvedValue({ data: OFFER });
      mockStartCheckout.mockResolvedValue({});
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);
      await userEvent.type(screen.getByTestId("coupon-input"), "LAUNCHOFFER");
      await userEvent.click(screen.getByTestId("coupon-apply"));
      await screen.findByTestId("coupon-applied");

      await userEvent.click(screen.getByTestId("buy-kit1"));
      await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledTimes(1));
      expect(mockStartCheckout).toHaveBeenCalledWith("kit1", { currency: "INR", couponCode: "LAUNCHOFFER" });

      await userEvent.click(screen.getByTestId("buy-bundle"));
      await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledTimes(2));
      expect(mockStartCheckout).toHaveBeenLastCalledWith("bundle", { currency: "INR", couponCode: "LAUNCHOFFER" });
    });

    it("shows the server's message for a wrong code and leaves the prices alone", async () => {
      mockApi.post.mockRejectedValue({ response: { status: 400, data: { detail: "That coupon code isn't valid." } } });
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      await userEvent.type(screen.getByTestId("coupon-input"), "NOPE");
      await userEvent.click(screen.getByTestId("coupon-apply"));

      expect(await screen.findByTestId("coupon-error")).toHaveTextContent("That coupon code isn't valid.");
      expect(screen.queryByTestId("coupon-applied")).not.toBeInTheDocument();
      expect(screen.queryByTestId("list-price-kit1")).not.toBeInTheDocument();
    });

    it("asks for a code before calling the server", async () => {
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      await userEvent.click(screen.getByTestId("coupon-apply"));

      expect(screen.getByTestId("coupon-error")).toHaveTextContent("Enter a coupon code.");
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it("removes the offer when the buyer clicks Remove", async () => {
      mockApi.post.mockResolvedValue({ data: OFFER });
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);
      await userEvent.type(screen.getByTestId("coupon-input"), "LAUNCHOFFER");
      await userEvent.click(screen.getByTestId("coupon-apply"));
      await screen.findByTestId("coupon-applied");

      await userEvent.click(screen.getByTestId("coupon-remove"));

      expect(screen.queryByTestId("list-price-kit1")).not.toBeInTheDocument();
      expect(screen.getByTestId("coupon-input")).toBeInTheDocument();
    });

    it("does not show the INR offer on the USD prices", async () => {
      mockApi.post.mockResolvedValue({ data: OFFER });
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);
      await userEvent.type(screen.getByTestId("coupon-input"), "LAUNCHOFFER");
      await userEvent.click(screen.getByTestId("coupon-apply"));
      await screen.findByTestId("coupon-applied");

      await userEvent.selectOptions(screen.getByLabelText(/currency/i), "USD");

      expect(screen.queryByTestId("list-price-kit1")).not.toBeInTheDocument();
      expect(screen.getByText("$69")).toBeInTheDocument();
    });

    it("has no coupon box when the catalog says no coupon is on", async () => {
      wireCatalog({ ...COUPON_CATALOG, coupons_enabled: false });
      renderPricing();
      await screen.findByText(PURCHASABLE_KIT.name);

      expect(screen.queryByTestId("coupon-input")).not.toBeInTheDocument();
    });
  });

  // ---- Links from the marketing site ---------------------------------------------
  it("highlights the kit named in ?focus= without the 'module is locked' message", async () => {
    wireCatalog(MULTI_CURRENCY);
    renderPricing("/pricing?focus=kit2");
    await screen.findByText("Agents Kit");

    const row = screen.getByTestId("buy-kit2").closest("div");
    expect(row).toHaveAttribute("data-focused", "true");
    expect(screen.getByTestId("buy-kit1").closest("div")).not.toHaveAttribute("data-focused");
    expect(screen.queryByText(/module is locked/i)).not.toBeInTheDocument();
  });

  it("still shows the 'module is locked' message for ?kit=", async () => {
    wireCatalog(MULTI_CURRENCY);
    renderPricing("/pricing?kit=kit1");
    await screen.findByText(PURCHASABLE_KIT.name);

    expect(screen.getByText(/module is locked/i)).toBeInTheDocument();
  });
});
