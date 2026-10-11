"""Smoke / example tests for the pricing catalog price anchors and sourcing.

Task 2.3 (kit-pricing-and-payments):
  - Assert kit base = 999900 and bundle base = 3999900 (Req 1.3, 1.4).
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
    """The catalog pins the mandated base prices in integer paise."""

    def test_kit_base_is_999900_paise(self):
        # Req 1.3: ₹9,999 per sellable kit.
        assert pricing_catalog.KIT_BASE_PAISE == 999900
        assert isinstance(pricing_catalog.KIT_BASE_PAISE, int)

    def test_bundle_base_is_3999900_paise(self):
        # Req 1.4: ₹39,999 bundle.
        assert pricing_catalog.BUNDLE_BASE_PAISE == 3999900
        assert isinstance(pricing_catalog.BUNDLE_BASE_PAISE, int)

    def test_base_price_paise_resolves_kit_to_anchor(self):
        # Any sellable kit id resolves to the kit base anchor (Req 1.3).
        for kit_id in pricing_catalog.KIT_CATALOG:
            assert pricing_catalog.base_price_paise(kit_id) == 999900

    def test_base_price_paise_resolves_bundle_to_anchor(self):
        # The reserved "bundle" selection resolves to the bundle base (Req 1.4).
        assert (
            pricing_catalog.base_price_paise(pricing_catalog.BUNDLE_SELECTION)
            == 3999900
        )

    def test_every_kit_view_reports_the_base_anchor(self):
        # Each exposed KitView carries the kit base price anchor (Req 1.3).
        for view in pricing_catalog.list_kits():
            assert view.base_price_paise == 999900


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
        assert hasattr(pricing_catalog, "KIT_BASE_PAISE")
        assert hasattr(pricing_catalog, "BUNDLE_BASE_PAISE")
        assert isinstance(pricing_catalog.KIT_CATALOG, dict)
        assert pricing_catalog.KIT_CATALOG  # non-empty config

    def test_routers_do_not_hardcode_catalog_values(self):
        # Scan every router source file: none may embed the price anchors or
        # redefine the kit catalog; they must source them from the config
        # module instead (Req 1.1).
        routers_dir = Path(pricing_catalog.__file__).parent / "routers"
        assert routers_dir.is_dir(), "expected app/routers/ directory to exist"

        forbidden_literals = ("999900", "3999900", "KIT_CATALOG =")

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
