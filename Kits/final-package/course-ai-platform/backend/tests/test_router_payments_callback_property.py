"""Property test for idempotent captured-only confirmation (Payment_Service) — Property 5.

# Feature: kit-pricing-and-payments, Property 5: Idempotent payment confirmation
# grants exactly once and requires a captured status — for any order whose
# server-side payment-status fetch returns `captured`, processing the callback
# confirmation one or more times leaves the order in `paid` status and results in
# exactly one active entitlement for that order (replays are acknowledged no-ops);
# conversely, for any order whose fetch returns a status other than `captured`,
# processing the callback leaves the order not `paid` and grants no entitlement.

Exercises ``POST /api/payments/callback`` (``confirm_callback``) via a direct
route-function call against an in-memory SQLite session (StaticPool). A ``User``
and an ``Order(status="created", razorpay_order_id=...)`` are seeded. Razorpay
credentials are forced on by patching the ``settings`` singleton used by the
router, and ``app.routers.payments.razorpay.Client`` is patched so
``payment.fetch`` returns ``{"status": <generated>}``. A VALID callback signature
is produced with ``callback_signature(order_id, payment_id, key_secret)`` so the
HMAC verification inside the endpoint passes. The test generates a ``captured``
flag, a replay count (1..3), and — for the non-captured branch — an arbitrary
status string that is not ``"captured"``.

**Validates: Requirements 6.4, 6.5, 6.6, 7.1, 7.2, 7.3**
"""

from unittest.mock import MagicMock, patch

from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import pricing_catalog as cat
from app.database import Base
from app.models import Entitlement, Order, User
from app.razorpay_signatures import callback_signature
from app.routers import payments
from app.schemas import CallbackIn

_KEY_ID = "rzp_test_key"
_KEY_SECRET = "super_secret"
_ORDER_RZP_ID = "order_rzp_123"
_PAYMENT_ID = "pay_abc_456"


def _make_session():
    """An in-memory SQLite session shared across the connection via StaticPool."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _seed_order(db):
    """Seed a buyer and a created order with a Razorpay order id."""
    user = User(
        id="buyer-1",
        email="buyer@test.com",
        full_name="Buyer",
        hashed_password="x",
    )
    db.add(user)
    db.commit()

    order = Order(
        user_id=user.id,
        selection="kit1",
        kind="individual",
        amount_paise=cat.base_price_paise("kit1"),
        currency="INR",
        discount_tier="none",
        razorpay_order_id=_ORDER_RZP_ID,
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return user, order


def _run_callback(db, status_value):
    """Invoke confirm_callback once with payment.fetch mocked to return status_value.

    A VALID signature is produced so the endpoint's HMAC verification passes.
    """
    signature = callback_signature(_ORDER_RZP_ID, _PAYMENT_ID, _KEY_SECRET)
    payload = CallbackIn(
        razorpay_order_id=_ORDER_RZP_ID,
        razorpay_payment_id=_PAYMENT_ID,
        razorpay_signature=signature,
    )

    mock_client = MagicMock()
    mock_client.payment.fetch.return_value = {"status": status_value}

    with patch.object(payments.settings, "razorpay_key_id", _KEY_ID), \
            patch.object(payments.settings, "razorpay_key_secret", _KEY_SECRET), \
            patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
        return payments.confirm_callback(payload, db=db)


# Feature: kit-pricing-and-payments, Property 5: Idempotent payment confirmation
# grants exactly once and requires a captured status.
@given(replays=st.integers(min_value=1, max_value=3))
@hyp_settings(max_examples=100, deadline=None)
def test_captured_confirmation_is_idempotent_and_grants_once(replays):
    """
    Captured status processed one or more times leaves the order `paid` with
    exactly one active entitlement; replays are no-ops.

    **Validates: Requirements 6.4, 6.5, 7.1, 7.2, 7.3**
    """
    db = _make_session()
    try:
        _user, order = _seed_order(db)

        for _ in range(replays):
            result = _run_callback(db, "captured")
            assert result == {"verified": True}

        db.expire_all()
        refreshed = db.query(Order).filter(Order.id == order.id).one()
        assert refreshed.status == "paid"

        # Exactly one active entitlement for (user, order), regardless of replays.
        ents = (
            db.query(Entitlement)
            .filter(
                Entitlement.user_id == _user.id,
                Entitlement.order_id == order.id,
                Entitlement.active.is_(True),
            )
            .all()
        )
        assert len(ents) == 1
    finally:
        db.close()


# Feature: kit-pricing-and-payments, Property 5: non-captured status leaves the
# order not paid with no entitlement.
@given(
    status_value=st.text(min_size=0, max_size=20).filter(lambda s: s != "captured"),
    replays=st.integers(min_value=1, max_value=3),
)
@hyp_settings(max_examples=100, deadline=None)
def test_non_captured_confirmation_grants_nothing(status_value, replays):
    """
    Any non-`captured` status leaves the order not `paid` and grants no
    entitlement, however many times it is processed.

    **Validates: Requirements 6.6**
    """
    db = _make_session()
    try:
        _user, order = _seed_order(db)

        for _ in range(replays):
            result = _run_callback(db, status_value)
            assert result == {"verified": False}

        db.expire_all()
        refreshed = db.query(Order).filter(Order.id == order.id).one()
        assert refreshed.status != "paid"
        assert refreshed.status == "created"

        ents = (
            db.query(Entitlement)
            .filter(Entitlement.order_id == order.id)
            .all()
        )
        assert len(ents) == 0
    finally:
        db.close()
