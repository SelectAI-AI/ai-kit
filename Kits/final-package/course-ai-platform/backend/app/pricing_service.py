"""Pricing service (Pricing_Service).

Server-authoritative price computation. All amounts are integers in the
currency's **minor unit** (paise for INR, cents for USD). This module is a pure
function layer: it never reads a client-supplied amount and never performs any
I/O (Req 4.7). Prices are a deterministic function of the selection, the
buyer's discount tier and the currency (Req 4.1, 4.6, 4.8).

An individual kit starts from its list price in the chosen currency. A discount
tier takes a percentage off that list price, rounded down to a whole currency
unit (whole rupee or whole dollar). The bundle
resolves to its list price regardless of tier; bundle-specific tier discounts
are out of scope.
"""

from .pricing_catalog import (
    BUNDLE_SELECTION,
    DEFAULT_CURRENCY,
    coupon_price_minor,
    price_minor,
)

# Percentage taken off an individual kit's list price, per discount tier.
TIER_PERCENT_OFF: dict[str, int] = {
    "none": 0,
    "student_t1": 35,   # approved students
    "corporate": 50,
    "college": 50,
}


def _discounted(list_minor: int, percent_off: int) -> int:
    """Apply ``percent_off`` and round down to a whole currency unit (100 minor units)."""
    return (list_minor * (100 - percent_off) // 100) // 100 * 100


def compute_price_minor(
    selection: str,
    tier: str,
    currency: str = DEFAULT_CURRENCY,
    coupon_code: str | None = None,
) -> int:
    """Compute the server-authoritative payable amount in minor units of ``currency``.

    ``selection`` is a kit id or ``"bundle"``; ``tier`` is one of
    ``none``/``student_t1``/``corporate``/``college``.

    A ``coupon_code`` is checked by the server and never trusted from the client.
    A valid coupon does not stack with a tier discount: the buyer pays whichever
    price is lower.

    Raises ``KeyError`` for an unknown tier, currency or selection, or when the
    kit has no price in ``currency``. Raises ``InvalidCoupon`` for a bad coupon.
    """
    percent_off = TIER_PERCENT_OFF[tier]
    list_minor = price_minor(selection, currency)
    if selection == BUNDLE_SELECTION:
        price = list_minor
    else:
        price = _discounted(list_minor, percent_off)
    if coupon_code:
        price = min(price, coupon_price_minor(coupon_code, selection, currency))
    return price


def compute_price_paise(selection: str, tier: str) -> int:
    """INR price in integer paise (the original single-currency entry point)."""
    return compute_price_minor(selection, tier, "INR")
