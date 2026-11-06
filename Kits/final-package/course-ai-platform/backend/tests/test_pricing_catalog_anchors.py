"""Smoke / example tests for the pricing catalog price anchors and sourcing.

Task 2.3 (kit-pricing-and-payments):
  - Assert the USD kit/bundle prices and the INR prices derived from them (Req 1.3, 1.4).
  - Assert the catalog is sourced from the config module, not hardcoded in a
    router (Req 1.1).

These are deliberately example/smoke tests (not property-based): they pin the
concrete price anchors mandated by the acceptance criteria and guard the
"config data, not hardcoded in a router" sourcing requirement.
"""

from pathlib import Path

from app import pricing_catalog


# ---------------------------------------------------------------------------
# Price anchors (Req 1.3, 1.4)
# ---------------------------------------------------------------------------


class TestCatalogPriceAnchors:
    """The catalog pins the selectAi USD prices and the INR prices derived from them."""

    def test_usd_list_prices_in_cents(self):
        assert pricing_catalog.KIT_PRICES_MINOR["USD"] == {
            "kit1": 6900, "kit2": 7900, "kit3": 2900, "kit4": 3900,
        }
        assert pricing_catalog.BUNDLE_PRICES_MINOR["USD"] == 19900

    def test_inr_prices_are_the_usd_prices_at_the_configured_rate(self):
        rate = pricing_catalog.USD_TO_INR_RATE
        assert rate == 95
        assert pricing_catalog.KIT_PRICES_MINOR["INR"] == {
            "kit1": 655500,   # $69  -> ₹6,555
            "kit2": 750500,   # $79  -> ₹7,505
            "kit3": 275500,   # $29  -> ₹2,755
            "kit4": 370500,   # $39  -> ₹3,705
        }
        assert pricing_catalog.BUNDLE_PRICES_MINOR["INR"] == 1890500   # $199 -> ₹18,905
        for kit_id, cents in pricing_catalog.KIT_PRICES_MINOR["USD"].items():
            assert pricing_catalog.KIT_PRICES_MINOR["INR"][kit_id] == cents * rate   # 1 cent = `rate` paise

    def test_prices_are_integers_in_minor_units(self):
        for table in pricing_catalog.KIT_PRICES_MINOR.values():
            for price in table.values():
                assert isinstance(price, int) and not isinstance(price, bool)
                assert price % 100 == 0   # whole major units
        for price in pricing_catalog.BUNDLE_PRICES_MINOR.values():
            assert isinstance(price, int) and price % 100 == 0

    def test_base_price_paise_resolves_priced_kits_and_bundle_in_inr(self):
        for kit_id, paise in pricing_catalog.KIT_PRICES_MINOR["INR"].items():
            assert pricing_catalog.base_price_paise(kit_id) == paise
        assert (
            pricing_catalog.base_price_paise(pricing_catalog.BUNDLE_SELECTION) == 1890500
        )

    def test_unpriced_kit_has_no_price_in_any_currency(self):
        # Kit 5 is not for sale: no price in any currency, and its legacy field is 0.
        assert "kit5" not in pricing_catalog.KIT_PRICES_MINOR["INR"]
        assert "kit5" not in pricing_catalog.KIT_PRICES_MINOR["USD"]
        view = pricing_catalog.get_kit("kit5")
        assert view.base_price_paise == 0 and view.prices == {}

    def test_every_kit_view_reports_its_inr_list_price(self):
        for view in pricing_catalog.list_kits():
            assert view.base_price_paise == pricing_catalog.KIT_PRICES_MINOR["INR"].get(view.kit_id, 0)


# ---------------------------------------------------------------------------
# Catalog sourcing: config module, not hardcoded in a router (Req 1.1)
# ---------------------------------------------------------------------------


class TestCatalogSourcedFromConfigModule:
    """Price anchors and the kit->slug mapping live in the config module.

    Req 1.1 requires kits/prices to be defined as configuration data rather
    than hardcoded in business/router logic. We assert both directions:
      1. The anchors are accessible as config data on ``app.pricing_catalog``.
      2. No file under ``app/routers/`` hardcodes the price anchors or the
         kit-catalog structure; routers must import from the config module.
    """

    def test_anchors_are_defined_as_config_data(self):
        # The config module exposes the catalog mapping and the anchors.
        assert hasattr(pricing_catalog, "KIT_CATALOG")
        assert hasattr(pricing_catalog, "KIT_PRICES_MINOR")
        assert hasattr(pricing_catalog, "BUNDLE_PRICES_MINOR")
        assert hasattr(pricing_catalog, "USD_TO_INR_RATE")
        assert isinstance(pricing_catalog.KIT_CATALOG, dict)
        assert pricing_catalog.KIT_CATALOG  # non-empty config

    def test_routers_do_not_hardcode_catalog_values(self):
        # Scan every router source file: none may embed the price anchors or
        # redefine the kit catalog; they must source them from the config
        # module instead (Req 1.1).
        routers_dir = Path(pricing_catalog.__file__).parent / "routers"
        assert routers_dir.is_dir(), "expected app/routers/ directory to exist"

        forbidden_literals = ("655500", "1890500", "19900", "KIT_CATALOG =")

        offenders: list[str] = []
        for py_file in routers_dir.glob("*.py"):
            source = py_file.read_text(encoding="utf-8")
            for literal in forbidden_literals:
                if literal in source:
                    offenders.append(f"{py_file.name} contains hardcoded {literal!r}")

        assert not offenders, (
            "catalog values must be sourced from app.pricing_catalog, not "
            f"hardcoded in routers: {offenders}"
        )
