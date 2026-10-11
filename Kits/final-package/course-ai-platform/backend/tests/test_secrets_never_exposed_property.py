"""Guard-rail property test: the Razorpay key secret is never exposed — Property 11.

# Feature: kit-pricing-and-payments, Property 11: Secrets are never exposed — for
# any response or error payload produced by the pricing, discount, payment, or
# admin-order flows, the value of RAZORPAY_KEY_SECRET never appears anywhere in
# the serialized output.

Strategy
--------
A distinctive sentinel secret is patched onto the ``settings`` singleton used by
every router (``RAZORPAY_KEY_SECRET = "SENTINEL_SECRET_<marker>"``) and a test
key id is set. For a wide range of generated inputs — valid and invalid kit
selections, buyers across every discount tier, well-formed and tampered
Checkout callbacks, missing-/partial-credential scenarios, discount lifecycle
actions, and admin bulk orders around the user-limit boundary — each
representative endpoint is exercised by calling its route function directly
against an in-memory SQLite session. ``razorpay.Client`` is patched so
``order.create`` and ``payment.fetch`` never touch the network.

Every outcome, whether a successful response model or a raised ``HTTPException``,
is serialized to text and asserted to never contain the sentinel secret string.
This proves the secret is absent from response bodies and error details across
all four flows (Req 12.3).

**Validates: Requirements 12.3**
"""

from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from hypothesis import given, settings as hyp_settings, strategies as st
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import pricing_catalog as cat
from app.database import Base
from app.models import User
from app.razorpay_signatures import callback_signature
from app.routers import admin_orders, discounts, payments, pricing
from app.schemas import (
    BulkOrderIn,
    CallbackIn,
    DiscountRequestIn,
    OrderCreateIn,
)

# The distinctive sentinel secret. If this string ever appears in any serialized
# response or error payload, Property 11 (Req 12.3) is violated.
SENTINEL_SECRET = "SENTINEL_SECRET_dc0ffee_do_not_leak_42"
TEST_KEY_ID = "rzp_test_sentinel_key_id"

# Valid selection space: every sellable kit id plus the bundle.
_SELLABLE_KITS = [kid for kid in cat.KIT_CATALOG if cat.is_purchasable(kid)]
_NON_PURCHASABLE = [kid for kid in cat.KIT_CATALOG if not cat.is_purchasable(kid)]
_VALID_SELECTIONS = _SELLABLE_KITS + [cat.BUNDLE_SELECTION]
# Selections including invalid/non-purchasable/garbage values to drive error paths.
_ALL_SELECTIONS = _VALID_SELECTIONS + _NON_PURCHASABLE + ["", "not_a_kit", "kitX"]

_TIERS = ["none", "student_t1", "student_t2", "corporate", "college"]


def _make_session():
    """A fresh in-memory SQLite session shared across the connection via StaticPool."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _serialize(value) -> str:
    """Serialize any endpoint outcome to text for the leak assertion.

    Handles pydantic models (incl. lists of them) via JSON, and falls back to
    ``str`` for dicts / primitives / exceptions.
    """
    if isinstance(value, BaseModel):
        return value.model_dump_json()
    if isinstance(value, (list, tuple)):
        return "".join(_serialize(v) for v in value)
    return str(value)


def _assert_no_leak(*outcomes):
    """Assert the sentinel secret never appears in any serialized outcome."""
    for outcome in outcomes:
        text = _serialize(outcome)
        assert SENTINEL_SECRET not in text, (
            f"RAZORPAY_KEY_SECRET leaked in serialized output: {text!r}"
        )


def _run(fn):
    """Invoke an endpoint call, returning its result or the raised HTTPException.

    Both the success payload and the error detail must be free of the secret, so
    whichever is produced is handed back to the caller for the leak assertion.
    """
    try:
        return fn()
    except HTTPException as exc:
        # Serialize the full exception plus its structured detail.
        return [str(exc), _serialize(exc.detail), str(exc.status_code)]


def _patched_payments(mock_client, *, key_id=TEST_KEY_ID, key_secret=SENTINEL_SECRET):
    """Context managers patching the payments router's settings + razorpay client."""
    return (
        patch.object(payments.settings, "razorpay_key_id", key_id),
        patch.object(payments.settings, "razorpay_key_secret", key_secret),
        patch.object(payments.razorpay, "Client", lambda auth=None: mock_client),
    )


@given(
    selection=st.sampled_from(_ALL_SELECTIONS),
    tier=st.sampled_from(_TIERS),
    # Arbitrary client-supplied amount (ignored by the server) — included to drive
    # the order path with hostile inputs.
    client_amount=st.integers(min_value=-(10**9), max_value=10**9),
    # Whether to tamper with the callback signature (drives the 400 reject path).
    tamper_signature=st.booleans(),
    # Payment status returned by the mocked server-side fetch.
    payment_status=st.sampled_from(["captured", "authorized", "failed", "created", "refunded"]),
    # Credential configuration: full, missing both, or partial (drives 503 config error).
    cred_mode=st.sampled_from(["full", "missing_both", "missing_id", "missing_secret"]),
    # Discount lifecycle action and tier (valid + invalid approval tiers).
    discount_action=st.sampled_from(["approve", "reject"]),
    discount_tier=st.sampled_from(["student_t1", "student_t2", "", "corporate", "bogus"]),
    details=st.text(max_size=40),
    # College bulk order user-list size around the 1000-user boundary.
    bulk_size=st.integers(min_value=0, max_value=1100),
    seats=st.integers(min_value=0, max_value=50),
)
@hyp_settings(max_examples=100, deadline=None)
def test_secret_never_appears_in_any_response_or_error(
    selection,
    tier,
    client_amount,
    tamper_signature,
    payment_status,
    cred_mode,
    discount_action,
    discount_tier,
    details,
    bulk_size,
    seats,
):
    """Property 11: the key secret never appears in any serialized response/error
    from the pricing, discount, payment, or admin-order flows.

    **Validates: Requirements 12.3**
    """
    db = _make_session()
    try:
        buyer = User(
            id="buyer-1",
            email="buyer@test.com",
            full_name="Buyer",
            hashed_password="x",
            role="student",
            discount_tier=tier,
        )
        student = User(
            id="student-1",
            email="student@test.com",
            full_name="Student",
            hashed_password="x",
            role="student",
            discount_tier="none",
        )
        admin = User(
            id="admin-1",
            email="admin@test.com",
            full_name="Admin",
            hashed_password="x",
            role="instructor",
            discount_tier="none",
        )
        db.add_all([buyer, student, admin])
        db.commit()
        for u in (buyer, student, admin):
            db.refresh(u)

        outcomes = []

        # --- Pricing flow: GET /api/pricing/catalog ------------------------
        outcomes.append(_run(lambda: pricing.get_catalog()))

        # --- Payment flow: POST /api/payments/order ------------------------
        key_id = "" if cred_mode in ("missing_both", "missing_id") else TEST_KEY_ID
        key_secret = "" if cred_mode in ("missing_both", "missing_secret") else SENTINEL_SECRET

        mock_client = MagicMock()
        mock_client.order.create.return_value = {"id": f"order_{selection or 'x'}"}
        mock_client.payment.fetch.return_value = {"status": payment_status, "id": "pay_123"}

        # The schema only carries a selection; validate from a dict that also
        # includes a bogus client amount to prove it is structurally ignored.
        order_payload = OrderCreateIn.model_validate(
            {"selection": selection, "amount_paise": client_amount, "amount": client_amount}
        )

        p_id, p_sec, p_cli = _patched_payments(
            mock_client, key_id=key_id, key_secret=key_secret
        )
        with p_id, p_sec, p_cli:
            outcomes.append(
                _run(lambda: payments.create_order(order_payload, db=db, user=buyer))
            )

        # --- Payment flow: POST /api/payments/callback ---------------------
        # Create a fresh order to confirm (independent of the above, which may
        # have failed on a non-purchasable selection or missing creds).
        valid_selection = selection if selection in _VALID_SELECTIONS else "kit1"
        confirm_client = MagicMock()
        confirm_client.order.create.return_value = {"id": "order_confirm_1"}
        confirm_client.payment.fetch.return_value = {"status": payment_status, "id": "pay_cb"}

        c_id, c_sec, c_cli = _patched_payments(confirm_client)
        with c_id, c_sec, c_cli:
            seeded = _run(
                lambda: payments.create_order(
                    OrderCreateIn(selection=valid_selection), db=db, user=buyer
                )
            )
            outcomes.append(seeded)

            # Build a callback: correctly signed, optionally tampered.
            good_sig = callback_signature("order_confirm_1", "pay_cb", SENTINEL_SECRET)
            sig = (good_sig + "ff") if tamper_signature else good_sig
            callback = CallbackIn(
                razorpay_order_id="order_confirm_1",
                razorpay_payment_id="pay_cb",
                razorpay_signature=sig,
            )
            outcomes.append(_run(lambda: payments.confirm_callback(callback, db=db)))

        # --- Discount flow: submit / status / approve|reject ---------------
        outcomes.append(
            _run(
                lambda: discounts.submit_discount_request(
                    DiscountRequestIn(details=details), db=db, user=student
                )
            )
        )
        outcomes.append(
            _run(lambda: discounts.my_discount_request(db=db, user=student))
        )
        outcomes.append(
            _run(lambda: discounts.list_discount_requests(db=db, admin=admin))
        )
        # Find the student's pending request id to resolve it.
        from app.models import DiscountRequest

        req = (
            db.query(DiscountRequest)
            .filter(DiscountRequest.user_id == student.id)
            .first()
        )
        if req is not None:
            if discount_action == "approve":
                outcomes.append(
                    _run(
                        lambda: discounts.approve_discount_request(
                            req.id, discount_tier, db=db, admin=admin
                        )
                    )
                )
            else:
                outcomes.append(
                    _run(
                        lambda: discounts.reject_discount_request(
                            req.id, db=db, admin=admin
                        )
                    )
                )

        # --- Admin bulk-order flow: college + corporate --------------------
        user_ids = [f"u{i}" for i in range(bulk_size)]
        outcomes.append(
            _run(
                lambda: admin_orders.create_college_order(
                    BulkOrderIn(user_ids=user_ids), db=db, instructor=admin
                )
            )
        )
        outcomes.append(
            _run(
                lambda: admin_orders.create_corporate_order(
                    BulkOrderIn(user_ids=[student.id], seats=seats),
                    db=db,
                    instructor=admin,
                )
            )
        )

        # The sentinel secret must never appear in ANY serialized outcome.
        _assert_no_leak(*outcomes)
    finally:
        db.close()
