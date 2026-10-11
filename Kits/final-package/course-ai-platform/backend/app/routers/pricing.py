"""Public pricing catalog router (Catalog_Service surface).

Exposes the kit and pricing catalog — kit names, covered module slugs, base
prices in integer paise, and the purchasable flag — sourced entirely from the
``pricing_catalog`` config module (Req 1.1, 1.6). No authentication is required:
the catalog is public so visitors can see pricing before purchasing (Req 11.1,
11.5). All monetary amounts are integer paise (INR only).
"""

from fastapi import APIRouter

from .. import pricing_catalog, schemas

router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.get("/catalog", response_model=schemas.CatalogOut)
def get_catalog():
    """Return the public pricing catalog (Req 1.6, 11.1, 11.5).

    Each kit view carries its id, display name, covered module slugs, base price
    in paise, and whether it is purchasable. The bundle coverage (all sellable
    kits' slugs plus the capstone) and the bundle base price are included so the
    pricing page can render the Full Bundle. Sourced from ``pricing_catalog``
    rather than hardcoded in the router (Req 1.1).
    """
    kits = [
        schemas.KitView(
            kit_id=kit.kit_id,
            name=kit.name,
            slugs=kit.slugs,
            base_price_paise=kit.base_price_paise,
            purchasable=kit.purchasable,
        )
        for kit in pricing_catalog.list_kits()
    ]
    return schemas.CatalogOut(
        kits=kits,
        bundle_slugs=pricing_catalog.bundle_slugs(),
        bundle_base_paise=pricing_catalog.BUNDLE_BASE_PAISE,
    )
