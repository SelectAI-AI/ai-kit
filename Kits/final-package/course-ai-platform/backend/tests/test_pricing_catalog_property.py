"""
Property test for the pricing catalog (Catalog_Service) invariants — Property 3.
Validates Requirements 1.2, 1.5, 1.6, 1.7
"""
from hypothesis import given, settings as hyp_settings, strategies as st

from app import pricing_catalog as cat


# Feature: kit-pricing-and-payments, Property 3: Catalog invariants — for any
# catalog configuration, every kit view exposes a non-empty kit_id, name, a
# slugs collection, and an integer base_price_paise; a kit is purchasable iff
# its slug set is non-empty; and the bundle's covered slugs equal exactly the
# union of all sellable (purchasable) kits' slugs plus the capstone slug.
@given(idx=st.integers(min_value=0, max_value=max(len(cat.KIT_CATALOG) - 1, 0)))
@hyp_settings(max_examples=100)
def test_catalog_invariants(idx):
    """
    Property 3: Catalog invariants.

    For any kit view in the catalog: kit_id and name are non-empty, slugs is a
    collection, base_price_paise is an integer, and purchasable iff slugs is
    non-empty. The bundle's covered slugs equal exactly the union of all
    sellable kits' slugs plus the capstone.

    **Validates: Requirements 1.2, 1.5, 1.6, 1.7**
    """
    kits = cat.list_kits()

    # list_kits returns a view for every configured kit (Req 1.2, 1.6).
    assert len(kits) == len(cat.KIT_CATALOG)

    # Index into the catalog via the generated index to drive many examples
    # across every configured kit.
    kit = kits[idx % len(kits)]

    # Every kit view has a non-empty kit_id and name (Req 1.2).
    assert isinstance(kit.kit_id, str) and kit.kit_id != ""
    assert isinstance(kit.name, str) and kit.name != ""

    # slugs is a collection (list) and base_price_paise is an integer (Req 1.2).
    assert isinstance(kit.slugs, list)
    assert isinstance(kit.base_price_paise, int)
    assert not isinstance(kit.base_price_paise, bool)

    # purchasable iff slugs non-empty (Req 1.7).
    assert kit.purchasable == (len(kit.slugs) > 0)
    # is_purchasable() agrees with the view flag.
    assert cat.is_purchasable(kit.kit_id) == kit.purchasable

    # Bundle slugs = union of all sellable kits' slugs plus the capstone (Req 1.5).
    expected: list[str] = []
    seen: set[str] = set()
    for kit_id, entry in cat.KIT_CATALOG.items():
        if not cat.is_purchasable(kit_id):
            continue
        for slug in entry.get("slugs") or []:
            if slug not in seen:
                seen.add(slug)
                expected.append(slug)
    if cat.CAPSTONE_SLUG not in seen:
        expected.append(cat.CAPSTONE_SLUG)

    bundle = cat.bundle_slugs()
    # Exact set equality for "union of sellable slugs plus capstone".
    assert set(bundle) == set(expected)
    # Capstone is always included in the bundle (Req 1.5).
    assert cat.CAPSTONE_SLUG in bundle
    # No non-sellable kit's slugs leak into the bundle.
    non_sellable_slugs: set[str] = set()
    for kit_id, entry in cat.KIT_CATALOG.items():
        if not cat.is_purchasable(kit_id):
            non_sellable_slugs.update(entry.get("slugs") or [])
    assert non_sellable_slugs.isdisjoint(set(bundle) - {cat.CAPSTONE_SLUG})
