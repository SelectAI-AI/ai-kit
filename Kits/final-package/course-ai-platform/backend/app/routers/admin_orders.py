"""Admin bulk orders (college / corporate).

Admin-only endpoints for creating bulk orders that onboard organizations without
the self-serve checkout flow (Req 10). All endpoints are guarded by
``require_instructor`` so non-admins receive a ``403`` and no state changes
(Req 10.6).

College orders record a flat ``499900`` paise price covering all sellable kits'
module slugs, limited to at most ``1000`` users (Req 10.1-10.3). Corporate orders
record ``499900`` paise per kit seat (Req 10.4). Finalizing either order grants
each listed existing user an active entitlement via the Entitlement_Service
(Req 10.5). All monetary amounts are integer paise (INR only).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import entitlement_service, models, schemas
from ..database import get_db
from ..deps import require_instructor
from ..pricing_catalog import BUNDLE_SELECTION

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders"])

# Flat bulk price in paise (₹4,999) applied per college order and per corporate
# kit seat (Req 10.1, 10.4).
BULK_FLAT_PAISE = 499900

# Maximum number of users a single College bulk order may cover (Req 10.2).
COLLEGE_MAX_USERS = 1000


@router.post("/college", response_model=schemas.EntitlementOut | list[schemas.EntitlementOut])
def create_college_order(
    payload: schemas.BulkOrderIn,
    db: Session = Depends(get_db),
    instructor: models.User = Depends(require_instructor),
):
    """Create a College bulk order (Req 10.1-10.3, 10.5, 10.6).

    Records a flat ``499900`` paise order covering all sellable kits' module
    slugs (the bundle selection snapshot) and grants each listed existing user an
    active entitlement. A list exceeding ``1000`` users is rejected with a
    validation error and no order is created (Req 10.3).
    """
    if len(payload.user_ids) > COLLEGE_MAX_USERS:
        # Reject before creating any order (Req 10.3).
        raise HTTPException(
            status_code=400,
            detail=f"A College bulk order may cover at most {COLLEGE_MAX_USERS} users",
        )

    order = models.Order(
        user_id=None,  # organization-level bulk order (Req 10.1)
        selection=BUNDLE_SELECTION,  # covers all sellable slugs
        kind="college",
        amount_paise=BULK_FLAT_PAISE,  # flat ₹4,999 (Req 10.1)
        currency="INR",
        discount_tier="college",
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Finalize: grant each listed existing user an active entitlement (Req 10.5).
    granted = entitlement_service.grant_bulk(db, order, payload.user_ids)
    return granted


@router.post("/corporate", response_model=schemas.EntitlementOut | list[schemas.EntitlementOut])
def create_corporate_order(
    payload: schemas.BulkOrderIn,
    db: Session = Depends(get_db),
    instructor: models.User = Depends(require_instructor),
):
    """Create a Corporate bulk order (Req 10.4, 10.5, 10.6).

    Records ``499900`` paise per kit seat and grants each listed existing user an
    active entitlement covering all sellable kits' module slugs.
    """
    seats = payload.seats if payload.seats is not None else len(payload.user_ids)
    if seats < 1:
        raise HTTPException(status_code=400, detail="Corporate order requires at least one seat")

    order = models.Order(
        user_id=None,  # organization-level bulk order
        selection=BUNDLE_SELECTION,  # covers all sellable slugs
        kind="corporate",
        amount_paise=BULK_FLAT_PAISE * seats,  # ₹4,999 per kit seat (Req 10.4)
        currency="INR",
        discount_tier="corporate",
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Finalize: grant each listed existing user an active entitlement (Req 10.5).
    granted = entitlement_service.grant_bulk(db, order, payload.user_ids)
    return granted
