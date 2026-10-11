"""Payment service router (Payment_Service).

Implements the Razorpay-backed purchase flow. All amounts are integer **paise**
(INR only). Prices are server-authoritative: the client supplies only a
selection and any client-supplied amount is ignored (Req 4.7, 5.1). The
Razorpay key secret is never serialized into any response, log, or error
message — only the key id is ever returned to the client (Req 12.3, 12.4).

This module is structured so the ``POST /api/payments/callback`` confirmation
endpoint (task 9.3) can be appended below the ``/order`` endpoint without
colliding with this file's router definition.
"""

from datetime import datetime

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import entitlement_service, models, schemas
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..pricing_catalog import BUNDLE_SELECTION, is_purchasable
from ..pricing_service import compute_price_paise
from ..razorpay_signatures import verify_callback

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _require_razorpay_credentials() -> tuple[str, str]:
    """Return ``(key_id, key_secret)`` or raise a 503 config error.

    The error references the configuration keys by name only and never echoes
    the (possibly partially set) secret values (Req 5.6, 12.3).
    """
    key_id = settings.razorpay_key_id
    key_secret = settings.razorpay_key_secret
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID "
                "and RAZORPAY_KEY_SECRET in the backend environment."
            ),
        )
    return key_id, key_secret


@router.post("/order", response_model=schemas.OrderCreateOut)
def create_order(
    payload: schemas.OrderCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Create a Razorpay order for the buyer's selection (Req 5).

    Validates the selection is purchasable (Req 5.4) and that the buyer does not
    already hold an active entitlement for it (Req 5.5), requires configured
    credentials (Req 5.6), computes the server-authoritative amount via the
    Pricing_Service (Req 4.7), creates the Razorpay order in INR, persists an
    ``Order(status="created")`` (Req 5.2), and returns the order id, amount,
    currency, and the Razorpay key id only (Req 5.3, 12.4).
    """
    selection = payload.selection

    # Req 5.4 — the selection must be a purchasable kit. "bundle" is always
    # purchasable; any other id must map to a kit with a non-empty slug set.
    if selection != BUNDLE_SELECTION and not is_purchasable(selection):
        raise HTTPException(
            status_code=400,
            detail=f"Selection '{selection}' is not purchasable.",
        )

    # Req 5.5 — reject when the buyer already holds an active entitlement for
    # this selection; name the existing entitlement and create no Razorpay order.
    existing = (
        db.query(models.Entitlement)
        .filter(
            models.Entitlement.user_id == user.id,
            models.Entitlement.selection == selection,
            models.Entitlement.active.is_(True),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already hold an active entitlement ({existing.id}) for "
                f"selection '{selection}'."
            ),
        )

    # Req 5.6 — credentials must be configured; the error never echoes secrets.
    key_id, key_secret = _require_razorpay_credentials()

    # Req 4.7 / 5.1 — server-authoritative amount; any client-supplied amount is
    # ignored because the request schema only carries a selection.
    amount_paise = compute_price_paise(selection, user.discount_tier)

    # Req 5.1 — create the Razorpay order with the amount in paise and INR.
    client = razorpay.Client(auth=(key_id, key_secret))
    rzp_order = client.order.create({"amount": amount_paise, "currency": "INR"})
    razorpay_order_id = rzp_order["id"]

    # Req 5.2 — persist the order linking buyer, selection, amount, tier, and
    # the Razorpay order id with status "created".
    order = models.Order(
        user_id=user.id,
        selection=selection,
        kind="individual",
        amount_paise=amount_paise,
        currency="INR",
        discount_tier=user.discount_tier,
        razorpay_order_id=razorpay_order_id,
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Req 5.3 / 12.4 — return the key id only; never the key secret.
    return schemas.OrderCreateOut(
        razorpay_order_id=razorpay_order_id,
        amount_paise=amount_paise,
        currency="INR",
        key_id=key_id,
    )


@router.post("/callback")
def confirm_callback(
    payload: schemas.CallbackIn,
    db: Session = Depends(get_db),
):
    """Confirm a Standard Checkout payment (Req 6, 7).

    The authoritative payment-confirmation flow:

    1. Verify the callback signature ``HMAC_SHA256(order_id|payment_id,
       key_secret)`` (Req 6.2). On failure the callback is rejected, the order is
       **not** marked ``paid``, and nothing is granted (Req 6.3).
    2. On a verified signature, perform a server-side payment-status fetch via
       ``razorpay.Client.payment.fetch(payment_id)`` (Req 6.4).
    3. Only when the fetched ``status == 'captured'`` is the order transitioned
       ``created → paid`` and its entitlements granted idempotently (Req 6.5,
       7.1, 7.3). A non-``captured`` status leaves the order unpaid and grants
       nothing (Req 6.6).
    4. A confirmation for an order already marked ``paid`` is an acknowledged
       no-op with no further state change (Req 7.2).
    """
    key_id, key_secret = _require_razorpay_credentials()

    order_id = payload.razorpay_order_id
    payment_id = payload.razorpay_payment_id
    signature = payload.razorpay_signature

    # Req 6.3 — reject on signature verification failure; grant nothing and do
    # not mark the order paid.
    if not verify_callback(order_id, payment_id, signature, key_secret):
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed.",
        )

    # Look up the order by the Razorpay order id carried in the callback.
    order = (
        db.query(models.Order)
        .filter(models.Order.razorpay_order_id == order_id)
        .first()
    )
    if order is None:
        raise HTTPException(
            status_code=404,
            detail=f"No order found for razorpay_order_id '{order_id}'.",
        )

    # Req 7.2 — a confirmation for an already-paid order is an acknowledged
    # no-op; make no further changes to the order or its entitlements.
    if order.status == "paid":
        return {"verified": True}

    # Req 6.4 — verified signature triggers a server-side payment-status fetch.
    client = razorpay.Client(auth=(key_id, key_secret))
    fetched = client.payment.fetch(payment_id)

    # Req 6.6 — a non-captured status leaves the order unpaid and grants nothing.
    if fetched.get("status") != "captured":
        return {"verified": False}

    # Req 6.5 / 7.1 — captured: transition created → paid, record the payment id,
    # and grant entitlements idempotently (exactly-once via the (user, order)
    # uniqueness constraint).
    order.status = "paid"
    order.razorpay_payment_id = payment_id
    order.paid_at = datetime.utcnow()
    db.add(order)
    db.commit()
    db.refresh(order)

    entitlement_service.grant_for_order(db, order)

    return {"verified": True}
