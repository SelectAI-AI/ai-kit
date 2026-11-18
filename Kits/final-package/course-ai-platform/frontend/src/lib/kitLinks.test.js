import { describe, it, expect } from "vitest";
import { KIT_SLUG_TO_KIT_ID, kitIdForSlug, pricingPathForKitSlug } from "./kitLinks.js";

// The marketing site's Explore Kit buttons open /kits/<slug>.
const MARKETING_SLUGS = ["foundation", "data-rag", "agents", "security", "production"];

describe("kitLinks", () => {
  it("maps every slug the marketing site uses to a platform kit", () => {
    for (const slug of MARKETING_SLUGS) {
      expect(kitIdForSlug(slug)).toMatch(/^kit\d$/);
    }
    expect(Object.keys(KIT_SLUG_TO_KIT_ID).sort()).toEqual([...MARKETING_SLUGS].sort());
  });

  it("maps to the kits that cover each topic", () => {
    expect(kitIdForSlug("foundation")).toBe("kit1");
    expect(kitIdForSlug("data-rag")).toBe("kit1");
    expect(kitIdForSlug("agents")).toBe("kit2");
    expect(kitIdForSlug("security")).toBe("kit2");
    expect(kitIdForSlug("production")).toBe("kit4");
  });

  it("ignores case and surrounding spaces", () => {
    expect(kitIdForSlug("  Agents ")).toBe("kit2");
  });

  it("returns undefined for an unknown or missing slug, including inherited object keys", () => {
    expect(kitIdForSlug("nope")).toBeUndefined();
    expect(kitIdForSlug("")).toBeUndefined();
    expect(kitIdForSlug(undefined)).toBeUndefined();
    expect(kitIdForSlug("constructor")).toBeUndefined();
    expect(kitIdForSlug("__proto__")).toBeUndefined();
  });

  it("builds the pricing path with the kit highlighted, or plain pricing when unknown", () => {
    expect(pricingPathForKitSlug("agents")).toBe("/pricing?focus=kit2");
    expect(pricingPathForKitSlug("nope")).toBe("/pricing");
    expect(pricingPathForKitSlug(undefined)).toBe("/pricing");
  });
});
