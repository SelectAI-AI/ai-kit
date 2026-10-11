import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  formatPaiseToInr,
  parseInrToPaise,
  paiseToWholeRupees,
  PAISE_PER_RUPEE,
  INR_SYMBOL,
} from "./pricing.js";

// Feature: kit-pricing-and-payments, Property 12: Frontend paise/₹ formatting — for any non-negative integer paise, formatting renders the correct whole-rupee INR string and the inverse parse round-trips to the original paise

describe("paise/₹ formatting (Property 12)", () => {
  // Validates: Requirements 11.2, 11.3

  // Max rupees generated: keeps values well within safe integer range after
  // the ×100 paise conversion while still spanning far beyond realistic prices.
  const MAX_RUPEES = 1_000_000_000;

  it("renders the correct whole-rupee INR string for any non-negative integer paise", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_RUPEES * PAISE_PER_RUPEE + PAISE_PER_RUPEE - 1 }),
        (paise) => {
          const rupees = Math.floor(paise / PAISE_PER_RUPEE);
          const expected = `${INR_SYMBOL}${rupees.toLocaleString("en-IN")}`;
          const formatted = formatPaiseToInr(paise);
          // Correct whole-rupee string: symbol + Indian-grouped whole rupees,
          // with sub-rupee paise dropped (floor).
          expect(formatted).toBe(expected);
          expect(formatted.startsWith(INR_SYMBOL)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("round-trips whole-rupee paise through format then parse back to the original paise", () => {
    // The forward format is whole-rupee (sub-rupee paise are floored away), so
    // the inverse parse can only recover whole-rupee amounts. Generate rupees
    // and scale to paise (multiples of 100) so the round-trip is exact.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_RUPEES }), (rupees) => {
        const paise = rupees * PAISE_PER_RUPEE;
        const roundTripped = parseInrToPaise(formatPaiseToInr(paise));
        expect(roundTripped).toBe(paise);
      }),
      { numRuns: 100 }
    );
  });

  it("floors sub-rupee paise so round-trip recovers the whole-rupee value for arbitrary paise", () => {
    // For arbitrary (not necessarily whole-rupee) paise, parsing the formatted
    // string recovers the floored whole-rupee amount in paise.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_RUPEES * PAISE_PER_RUPEE }),
        (paise) => {
          const expectedPaise = paiseToWholeRupees(paise) * PAISE_PER_RUPEE;
          expect(parseInrToPaise(formatPaiseToInr(paise))).toBe(expectedPaise);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Explicit catalog price anchors (Req 11.2): the generator may not hit these
  // exact values within a small run count, so assert them directly.
  it("formats the catalog price anchors exactly", () => {
    expect(formatPaiseToInr(999900)).toBe("₹9,999");
    expect(formatPaiseToInr(3999900)).toBe("₹39,999");
    expect(formatPaiseToInr(649900)).toBe("₹6,499");
    expect(formatPaiseToInr(499900)).toBe("₹4,999");

    expect(parseInrToPaise("₹9,999")).toBe(999900);
    expect(parseInrToPaise("₹39,999")).toBe(3999900);
    expect(parseInrToPaise("₹6,499")).toBe(649900);
    expect(parseInrToPaise("₹4,999")).toBe(499900);
  });

  // Boundary: zero paise formats as "₹0" and round-trips.
  it("handles zero paise", () => {
    expect(formatPaiseToInr(0)).toBe("₹0");
    expect(parseInrToPaise("₹0")).toBe(0);
  });
});
