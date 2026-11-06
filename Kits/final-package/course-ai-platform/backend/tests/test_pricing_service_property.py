"""
Property test for the pricing service (Pricing_Service) table correctness — Property 1.
Validates Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 1.3, 1.4
"""
from hypothesis import given, settings as hyp_settings, strategies as st

from app import pricing_catalog as cat
from app.pricing_service import TIER_PERCENT_OFF, compute_price_paise


# Sellable selections = every purchasable kit id plus the reserved bundle id.
# Kit 5 (non-purchasable, empty slugs) is excluded from the sellable space.
_SELLABLE_KITS = [kit_id for kit_id in cat.KIT_CATALOG if cat.is_purchasable(kit_id)]
_SELLABLE_SELECTIONS = _SELLABLE_KITS + [cat.BUNDLE_SELECTION]

_TIERS = list(TIER_PERCENT_OFF)  # none, student_t1, student_t2, corporate, college


# Feature: kit-pricing-and-payments, Property 1: Pricing table correctness —
# for any selection (a sellable kit id or "bundle") and any discount tier in
# {none, student_t1, student_t2, corporate, college}, compute_price_paise
# returns the exact mandated integer paise for that tier (individual kit: the
# kit's INR list price less 0/35/50/50/50 percent, rounded down to a whole rupee;
# bundle = the INR bundle list price for every tier), the result is always a
# non-negative int, and the computation is deterministic (same inputs -> same output).
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
        # Bundle resolves to its INR list price, tier-independent (Req 1.4).
        expected = cat.BUNDLE_PRICES_MINOR["INR"]
        assert expected == 1890500
    else:
        # Individual kit: INR list price less the tier percentage, rounded down
        # to a whole rupee (Req 4.2-4.5).
        list_price = cat.KIT_PRICES_MINOR["INR"][selection]
        percent = {"none": 0, "student_t1": 35, "student_t2": 50, "corporate": 50, "college": 50}[tier]
        expected = (list_price * (100 - percent) // 100) // 100 * 100
        if tier == "none":
            assert expected == list_price

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
