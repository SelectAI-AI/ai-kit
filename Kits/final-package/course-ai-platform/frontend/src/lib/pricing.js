// Pure pricing/formatting helpers for the kit-pricing-and-payments feature.
//
// Money is always integer paise (₹1 = 100 paise), INR only. These helpers are
// side-effect free so they can be exhaustively exercised with fast-check
// property-based tests. Display is whole-rupee (paise below a rupee are
// dropped), matching the catalog's whole-rupee price anchors
// (e.g. 999900 → "₹9,999").

/** Number of paise in one rupee. @type {number} */
export const PAISE_PER_RUPEE = 100;

/** The INR currency symbol used for display. @type {string} */
export const INR_SYMBOL = "\u20B9"; // ₹

/**
 * Human-readable labels for each discount tier. Mirrors the backend
 * Discount_Tier values; used by the pricing UI to describe a tier.
 * @type {Readonly<Record<string, string>>}
 */
export const TIER_LABELS = Object.freeze({
  none: "Standard",
  student_t1: "Student (35% off)",
  student_t2: "Student (50% off)",
  corporate: "Corporate",
  college: "College (bulk)",
});

/** Fallback label for an unknown or missing tier. @type {string} */
export const UNKNOWN_TIER_LABEL = "Unknown";

/**
 * Map a discount tier identifier to its display label.
 *
 * @param {string} tier - A tier id such as "none" or "student_t1".
 * @returns {string} The label for the tier, or {@link UNKNOWN_TIER_LABEL}
 *   when the tier is not recognized.
 */
export function tierLabel(tier) {
  if (typeof tier === "string" && Object.prototype.hasOwnProperty.call(TIER_LABELS, tier)) {
    return TIER_LABELS[tier];
  }
  return UNKNOWN_TIER_LABEL;
}

/**
 * Convert integer paise to a whole number of rupees, dropping any sub-rupee
 * remainder (floor). Negative and non-integer inputs are rejected.
 *
 * @param {number} paise - A non-negative integer amount in paise.
 * @returns {number} The whole-rupee amount.
 * @throws {TypeError} When `paise` is not a non-negative integer.
 */
export function paiseToWholeRupees(paise) {
  if (typeof paise !== "number" || !Number.isInteger(paise) || paise < 0) {
    throw new TypeError("paise must be a non-negative integer");
  }
  return Math.floor(paise / PAISE_PER_RUPEE);
}

/**
 * Format integer paise as a whole-rupee INR string with grouped thousands.
 *
 * Sub-rupee paise are dropped (whole-rupee display). The grouping uses the
 * Indian numbering convention via `toLocaleString("en-IN")`.
 *
 * @example
 * formatPaiseToInr(999900);  // "₹9,999"
 * formatPaiseToInr(3999900); // "₹39,999"
 * formatPaiseToInr(649900);  // "₹6,499"
 * formatPaiseToInr(499900);  // "₹4,999"
 *
 * @param {number} paise - A non-negative integer amount in paise.
 * @returns {string} The formatted whole-rupee INR string, e.g. "₹9,999".
 * @throws {TypeError} When `paise` is not a non-negative integer.
 */
export function formatPaiseToInr(paise) {
  const rupees = paiseToWholeRupees(paise);
  return `${INR_SYMBOL}${rupees.toLocaleString("en-IN")}`;
}

/**
 * Inverse of {@link formatPaiseToInr}: parse a formatted whole-rupee INR
 * string back to integer paise.
 *
 * Accepts the ₹ symbol and digit-group separators (commas). Because the
 * forward format is whole-rupee, parsing a string produced by
 * `formatPaiseToInr` yields the whole-rupee paise value (a multiple of 100).
 *
 * @example
 * parseInrToPaise("₹9,999"); // 999900
 *
 * @param {string} formatted - A string produced by {@link formatPaiseToInr}.
 * @returns {number} The amount in integer paise.
 * @throws {TypeError} When `formatted` is not a parseable whole-rupee INR string.
 */
export function parseInrToPaise(formatted) {
  if (typeof formatted !== "string") {
    throw new TypeError("formatted must be a string");
  }
  // Strip the currency symbol, grouping separators, and surrounding whitespace.
  const digits = formatted
    .replace(INR_SYMBOL, "")
    .replace(/,/g, "")
    .trim();
  if (digits === "" || !/^\d+$/.test(digits)) {
    throw new TypeError("formatted must be a whole-rupee INR string");
  }
  const rupees = Number.parseInt(digits, 10);
  return rupees * PAISE_PER_RUPEE;
}
