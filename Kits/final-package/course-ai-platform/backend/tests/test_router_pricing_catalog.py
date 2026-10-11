"""Smoke tests for the public pricing catalog endpoint.

Verifies ``GET /api/pricing/catalog`` is registered, requires no auth, and
returns the catalog sourced from ``pricing_catalog`` — kit names, covered
module slugs, base prices in paise, the purchasable flag, and the bundle
coverage/base price (Req 1.6, 11.1, 11.5).
"""

from fastapi.testclient import TestClient

from app.main import app
from app import pricing_catalog


def _client():
    return TestClient(app)


def test_catalog_endpoint_returns_200_without_auth():
    """The catalog is public: no Authorization header is required (Req 11.1, 11.5)."""
    resp = _client().get("/api/pricing/catalog")
    assert resp.status_code == 200


def test_catalog_payload_matches_pricing_catalog_source():
    """Kits, slugs, prices, and purchasable flags come from pricing_catalog (Req 1.1, 1.6)."""
    data = _client().get("/api/pricing/catalog").json()

    expected_kits = pricing_catalog.list_kits()
    assert len(data["kits"]) == len(expected_kits)

    by_id = {k["kit_id"]: k for k in data["kits"]}
    for kit in expected_kits:
        got = by_id[kit.kit_id]
        assert got["name"] == kit.name
        assert got["slugs"] == kit.slugs
        assert got["base_price_paise"] == kit.base_price_paise
        assert got["purchasable"] == kit.purchasable

    assert data["bundle_slugs"] == pricing_catalog.bundle_slugs()
    assert data["bundle_base_paise"] == pricing_catalog.BUNDLE_BASE_PAISE


def test_non_purchasable_kit_flagged_in_catalog():
    """Kit 5 (no slugs) is exposed as non-purchasable (Req 1.7, 11.4)."""
    data = _client().get("/api/pricing/catalog").json()
    by_id = {k["kit_id"]: k for k in data["kits"]}
    assert by_id["kit5"]["purchasable"] is False
    assert by_id["kit5"]["slugs"] == []
