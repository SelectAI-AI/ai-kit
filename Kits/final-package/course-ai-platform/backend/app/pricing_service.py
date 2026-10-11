"""Pricing service (Pricing_Service).

Server-authoritative price computation. All amounts are integer **paise**
(INR only; ₹1 = 100 paise). This module is a pure function layer: it never
reads a client-supplied amount and never performs any I/O (Req 4.7). Prices
are a deterministic function of the selection and the buyer's discount tier
(Req 4.1, 4.6, 4.8).

Individual-kit tier prices are fixed table lookups per Req 4.2–4.5 and are
independent of which kit is selected. The bundle resolves to the catalog
``BUNDLE_BASE_PAISE`` (Req 1.4); bundle-specific tier discounts are out of
scope for v1, so the bundle resolves to its base regardless of tier.
"""

from .pricing_catalog import BUNDLE_BASE_PAISE, BUNDLE_SELECTION

# Individual-kit price in paise per discount tier (Req 4.2–4.5, 10.1).
DISCOUNT_KIT_PAISE: dict[str, int] = {
    "none": 999900,        # ₹9,999  base price (Req 4.5)
    "student_t1": 649900,  # ₹6,499  35% off (Req 4.2)
    "student_t2": 499900,  # ₹4,999  50% off (Req 4.3)
    "corporate": 499900,   # ₹4,999  Tier-2 equivalent (Req 4.4)
    "college": 499900,     # ₹4,999  bulk flat (Req 10.1)
}


def compute_price_paise(selection: str, tier: str) -> int:
    """Compute the server-authoritative payable amount in integer paise.

    ``selection`` is a kit id or ``"bundle"``; ``tier`` is one of
    ``none``/``student_t1``/``student_t2``/``corporate``/``college``.

    The bundle resolves to ``BUNDLE_BASE_PAISE`` (Req 1.4). An individual kit
    resolves to the fixed per-tier price in ``DISCOUNT_KIT_PAISE`` (Req 4.2–4.5).
    The result is always a non-negative integer paise value in INR, computed
    deterministically from the inputs (Req 4.1, 4.6, 4.8).

    Raises ``KeyError`` for an unknown discount tier.
    """
    if selection == BUNDLE_SELECTION:
        return BUNDLE_BASE_PAISE
    return DISCOUNT_KIT_PAISE[tier]
