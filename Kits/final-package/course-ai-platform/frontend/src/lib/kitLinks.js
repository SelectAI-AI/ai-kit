// Links from the selectAi marketing site into the learning platform.
//
// The marketing site's "Explore Kit" buttons open /kits/<slug>, and its
// "Enroll Now" button opens /kits. The marketing site shows five specialization
// kits while the platform sells four, so each marketing slug points at the
// platform kit that covers it. The mapping lives here so it is easy to change.

/**
 * Marketing slug -> platform kit id (see backend/app/pricing_catalog.py).
 * @type {Readonly<Record<string, string>>}
 */
export const KIT_SLUG_TO_KIT_ID = Object.freeze({
  foundation: "kit1", // AI/ML Engineering Foundation -> Foundations
  "data-rag": "kit1", // Data Engineering & RAG -> Foundations covers db and rag-engineering
  agents: "kit2", // Agentic AI & Multi-Agent Systems -> Agentic AI & Guardrails
  security: "kit2", // AI Security & Governance -> the guardrails modules in kit 2
  production: "kit4", // Production AI -> AI Ops
});

/**
 * The platform kit id for a marketing slug, or `undefined` for an unknown slug.
 *
 * @param {string | undefined} slug - The `/kits/<slug>` path segment.
 * @returns {string | undefined} A kit id such as "kit1".
 */
export function kitIdForSlug(slug) {
  if (typeof slug !== "string") return undefined;
  const key = slug.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(KIT_SLUG_TO_KIT_ID, key)
    ? KIT_SLUG_TO_KIT_ID[key]
    : undefined;
}

/**
 * Where a `/kits/<slug>` link should land: the pricing page, with the matching
 * kit highlighted when the slug is known.
 *
 * @param {string | undefined} slug
 * @returns {string} A path such as "/pricing?focus=kit1" or "/pricing".
 */
export function pricingPathForKitSlug(slug) {
  const kitId = kitIdForSlug(slug);
  return kitId ? `/pricing?focus=${encodeURIComponent(kitId)}` : "/pricing";
}
