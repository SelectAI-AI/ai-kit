"""
Property test for the pricing service (Pricing_Service) table correctness — Property 1.
Validates Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 1.3, 1.4
"""
from hypothesis import given, settings as hyp_settings, strategies as st

from app import pricing_catalog as cat
from app.pricing_service import DISCOUNT_KIT_PAISE, compute_price_paise


# Sellable selections = every purchasable kit id plus the reserved bundle id.
# Kit 5 (non-purchasable, empty slugs) is excluded from the sellable space.
_SELLABLE_KITS = [kit_id for kit_id in cat.KIT_CATALOG if cat.is_purchasable(kit_id)]
_SELLABLE_SELECTIONS = _SELLABLE_KITS + [cat.BUNDLE_SELECTION]

_TIERS = list(DISCOUNT_KIT_PAISE.keys())  # none, student_t1, student_t2, corporate, college


# Feature: kit-pricing-and-payments, Property 1: Pricing table correctness —
# for any selection (a sellable kit id or "bundle") and any discount tier in
# {none, student_t1, student_t2, corporate, college}, compute_price_paise
# returns the exact mandated integer paise for that tier (individual kit:
# none=999900, student_t1=649900, student_t2=499900, corporate=499900,
# college=499900; bundle base=3999900), the result is always a non-negative
# int, and the computation is deterministic (same inputs -> same output).
@given(
    selection=st.sampled_from(_SELLABLE_SELECTIONS),
    tier=st.sampled_from(_TIERS),
)
@hyp_settings(max_examples=100)
def test_pricing_table_correctness(selection, tier):
    """
    Property 1: Pricing table correctness.

    For any sellable selection and tier, compute_price_paise returns the exact
    mandated integer paise, always a non-negative int, deterministically.

    **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 1.3, 1.4**
    """
    result = compute_price_paise(selection, tier)

    # Expected amount per the mandated pricing table (Req 4.2-4.5, 1.3, 1.4).
    if selection == cat.BUNDLE_SELECTION:
        # Bundle resolves to BUNDLE_BASE_PAISE = 3999900 (Req 1.4), tier-independent.
        expected = cat.BUNDLE_BASE_PAISE
        assert expected == 3999900
    else:
        # Individual kit: fixed per-tier price (Req 4.2-4.5).
        expected = DISCOUNT_KIT_PAISE[tier]
        # Anchor the mandated per-tier values explicitly.
        assert expected == {
            "none": 999900,        # ₹9,999 base (Req 4.5, 1.3)
            "student_t1": 649900,  # ₹6,499 (Req 4.2)
            "student_t2": 499900,  # ₹4,999 (Req 4.3)
            "corporate": 499900,   # ₹4,999 (Req 4.4)
            "college": 499900,     # ₹4,999 (Req 10.1)
        }[tier]

    # Exact mandated integer paise (Req 4.1, 4.2-4.5).
    assert result == expected

    # Always an int (not a bool) and in integer paise (Req 4.6).
    assert isinstance(result, int)
    assert not isinstance(result, bool)

    # Always non-negative.
    assert result >= 0

    # Deterministic: same inputs -> same output (Req 4.1).
    assert compute_price_paise(selection, tier) == result
    assert compute_price_paise(selection, tier) == result
