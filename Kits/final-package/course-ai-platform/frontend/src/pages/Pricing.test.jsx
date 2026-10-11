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
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { formatPaiseToInr } from "../lib/pricing";

// Pricing uses useLocation() (to read ?kit=), so it must render inside a
// Router context. Wrap it in MemoryRouter for every render.
function renderPricing() {
  return render(
    <MemoryRouter initialEntries={["/pricing"]}>
      <Pricing />
    </MemoryRouter>
  );
}

// ---- Mock the API client -------------------------------------------------
// Pricing only calls api.get("/api/pricing/catalog"); route it to the fixture.
const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn() },
}));
vi.mock("../api", () => ({ default: mockApi }));

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
});
