"""Example/integration tests for payment confirmation and secrets — Task 9.5.

Covers the ``POST /api/payments/callback`` confirmation flow and the
secrets-exposure guarantees of ``POST /api/payments/order``:

  - With ``payment.fetch`` mocked to ``captured``, a verified callback marks the
    order ``paid`` and grants exactly one active entitlement; a non-``captured``
    status leaves the order unpaid with no entitlement (Req 6.4, 6.5, 6.6).
  - Replaying the same verified callback grants exactly one active entitlement and
    leaves the order ``paid`` (Req 7.1–7.3).
  - The missing-credentials config error omits the secret value; the order
    response exposes ``key_id`` and the serialized order/callback payloads never
    leak the key secret (Req 5.6, 12.3, 12.4).

These are example tests (no Hypothesis). They call the router functions directly
against an in-memory SQLite session and patch ``app.routers.payments.razorpay``
so no network I/O occurs. A valid callback signature is produced with the real
pure helper ``razorpay_signatures.callback_signature``.

**Validates: Requirements 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 5.6, 12.3, 12.4**
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.entitlement_service import _slugs_for_selection
from app.models import Entitlement, Order, User
from app.razorpay_signatures import callback_signature
from app.routers import payments
from app.schemas import CallbackIn, OrderCreateIn

# A kit secret used across the suite. If this string ever appears in a response
# or error payload, the secrets-exposure guarantees (Req 12.3) are violated.
KEY_ID = "rzp_test_key_id"
KEY_SECRET = "super_secret_value_do_not_leak"


def _make_session():
    """A fresh in-memory SQLite session shared via StaticPool."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()


def _seed_buyer(db, tier="none"):
    buyer = User(
        id="buyer-1",
        email="buyer@test.com",
        full_name="Buyer",
        hashed_password="x",
        discount_tier=tier,
    )
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    return buyer


def _seed_order(db, buyer, selection="kit1", rzp_order_id="order_abc123"):
    """Persist an Order(status='created') for the buyer/selection."""
    order = Order(
        user_id=buyer.id,
        selection=selection,
        kind="individual",
        amount_paise=999900,
        currency="INR",
        discount_tier=buyer.discount_tier,
        razorpay_order_id=rzp_order_id,
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def _mock_client_with_status(status):
    """A MagicMock Razorpay client whose payment.fetch returns ``{"status": ...}``."""
    mock_client = MagicMock()
    mock_client.payment.fetch.return_value = {"status": status, "id": "pay_abc123"}
    return mock_client


def _call_callback(db, order, payment_id, mock_client):
    """Invoke confirm_callback with a correctly-signed callback and patched creds."""
    signature = callback_signature(order.razorpay_order_id, payment_id, KEY_SECRET)
    payload = CallbackIn(
        razorpay_order_id=order.razorpay_order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=signature,
    )
    with patch.object(payments.settings, "razorpay_key_id", KEY_ID), \
            patch.object(payments.settings, "razorpay_key_secret", KEY_SECRET), \
            patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
        return payments.confirm_callback(payload, db=db)


# ---------------------------------------------------------------------------
# Captured status → paid + entitlement granted (Req 6.4, 6.5)
# ---------------------------------------------------------------------------


class TestCapturedConfirmation:
    """A verified callback with payment.fetch==captured pays the order and grants.

    **Validates: Requirements 6.4, 6.5**
    """

    def test_captured_marks_order_paid_and_grants_entitlement(self):
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            order = _seed_order(db, buyer, selection="kit1")

            result = _call_callback(
                db, order, "pay_abc123", _mock_client_with_status("captured")
            )

            assert result == {"verified": True}

            db.refresh(order)
            assert order.status == "paid"
            assert order.razorpay_payment_id == "pay_abc123"
            assert order.paid_at is not None

            ents = (
                db.query(Entitlement)
                .filter(
                    Entitlement.order_id == order.id,
                    Entitlement.active.is_(True),
                )
                .all()
            )
            assert len(ents) == 1, "captured confirmation grants exactly one entitlement"
            ent = ents[0]
            assert ent.user_id == buyer.id
            assert ent.selection == "kit1"
            # Snapshot equals exactly the configured slugs for the selection.
            expected_slugs = set(_slugs_for_selection("kit1"))
            assert set(ent.slugs_csv.split(",")) == expected_slugs
        finally:
            db.close()

    def test_captured_server_side_fetch_is_performed(self):
        """A verified signature triggers a server-side payment.fetch (Req 6.4)."""
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            order = _seed_order(db, buyer, selection="kit1")
            mock_client = _mock_client_with_status("captured")

            _call_callback(db, order, "pay_abc123", mock_client)

            mock_client.payment.fetch.assert_called_once_with("pay_abc123")
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Non-captured status → unpaid, no entitlement (Req 6.6)
# ---------------------------------------------------------------------------


class TestNonCapturedConfirmation:
    """A non-captured payment status leaves the order unpaid and grants nothing.

    **Validates: Requirements 6.6**
    """

    @pytest.mark.parametrize("status", ["authorized", "failed", "created", "refunded", "pending"])
    def test_non_captured_leaves_unpaid_no_entitlement(self, status):
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            order = _seed_order(db, buyer, selection="kit1")

            result = _call_callback(
                db, order, "pay_abc123", _mock_client_with_status(status)
            )

            assert result == {"verified": False}

            db.refresh(order)
            assert order.status != "paid"
            assert order.status == "created"

            ents = db.query(Entitlement).filter(Entitlement.order_id == order.id).all()
            assert ents == [], f"no entitlement should be granted for status={status!r}"
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Replay / idempotency → exactly one entitlement (Req 7.1–7.3)
# ---------------------------------------------------------------------------


class TestReplayIdempotency:
    """Replaying the same verified callback grants exactly one active entitlement.

    **Validates: Requirements 7.1, 7.2, 7.3**
    """

    def test_replay_grants_exactly_one_entitlement(self):
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            order = _seed_order(db, buyer, selection="bundle")
            mock_client = _mock_client_with_status("captured")

            # Process the same verified callback three times.
            r1 = _call_callback(db, order, "pay_abc123", mock_client)
            r2 = _call_callback(db, order, "pay_abc123", mock_client)
            r3 = _call_callback(db, order, "pay_abc123", mock_client)

            assert r1 == {"verified": True}
            assert r2 == {"verified": True}
            assert r3 == {"verified": True}

            db.refresh(order)
            assert order.status == "paid"

            ents = (
                db.query(Entitlement)
                .filter(
                    Entitlement.order_id == order.id,
                    Entitlement.active.is_(True),
                )
                .all()
            )
            assert len(ents) == 1, "replays must not double-grant"
        finally:
            db.close()

    def test_already_paid_confirmation_is_noop(self):
        """A confirmation for an already-paid order is an acknowledged no-op (Req 7.2)."""
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            order = _seed_order(db, buyer, selection="kit1")

            # First confirmation pays the order and grants.
            _call_callback(db, order, "pay_abc123", _mock_client_with_status("captured"))
            db.refresh(order)
            assert order.status == "paid"

            # Second confirmation: the no-op branch must not even call payment.fetch.
            noop_client = _mock_client_with_status("captured")
            result = _call_callback(db, order, "pay_abc123", noop_client)

            assert result == {"verified": True}
            noop_client.payment.fetch.assert_not_called()

            ents = (
                db.query(Entitlement)
                .filter(Entitlement.order_id == order.id, Entitlement.active.is_(True))
                .all()
            )
            assert len(ents) == 1
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Secrets never leak (Req 5.6, 12.3, 12.4)
# ---------------------------------------------------------------------------


class TestSecretsAreNeverExposed:
    """Missing-credentials errors and responses never contain the key secret.

    **Validates: Requirements 5.6, 12.3, 12.4**
    """

    def test_missing_credentials_config_error_omits_secret(self):
        """create_order with empty credentials → 503 that never echoes the secret (Req 5.6)."""
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            payload = OrderCreateIn(selection="kit1")

            # Both credentials empty — the config guard must raise 503.
            with patch.object(payments.settings, "razorpay_key_id", ""), \
                    patch.object(payments.settings, "razorpay_key_secret", ""):
                with pytest.raises(HTTPException) as exc_info:
                    payments.create_order(payload, db=db, user=buyer)

            assert exc_info.value.status_code == 503
            # The detail references config keys by name only, never the value.
            assert KEY_SECRET not in str(exc_info.value.detail)
            # No order is created when credentials are unset.
            assert db.query(Order).count() == 0
        finally:
            db.close()

    def test_partial_credentials_config_error_omits_secret(self):
        """A secret set but key id empty still errors without echoing the secret (Req 5.6, 12.3)."""
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            payload = OrderCreateIn(selection="kit1")

            with patch.object(payments.settings, "razorpay_key_id", ""), \
                    patch.object(payments.settings, "razorpay_key_secret", KEY_SECRET):
                with pytest.raises(HTTPException) as exc_info:
                    payments.create_order(payload, db=db, user=buyer)

            assert exc_info.value.status_code == 503
            assert KEY_SECRET not in str(exc_info.value.detail)
        finally:
            db.close()

    def test_order_response_exposes_key_id_not_secret(self):
        """The order response exposes key_id and never serializes the secret (Req 12.4, 12.3)."""
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            payload = OrderCreateIn(selection="kit1")

            mock_client = MagicMock()
            mock_client.order.create.return_value = {"id": "order_abc123"}

            with patch.object(payments.settings, "razorpay_key_id", KEY_ID), \
                    patch.object(payments.settings, "razorpay_key_secret", KEY_SECRET), \
                    patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
                result = payments.create_order(payload, db=db, user=buyer)

            # key_id is exposed to the client for opening Standard Checkout (Req 12.4).
            assert result.key_id == KEY_ID
            # The serialized response never contains the key secret (Req 12.3).
            assert KEY_SECRET not in result.model_dump_json()
        finally:
            db.close()

    def test_callback_response_never_leaks_secret(self):
        """The callback confirmation response never contains the key secret (Req 12.3)."""
        db = _make_session()
        try:
            buyer = _seed_buyer(db)
            order = _seed_order(db, buyer, selection="kit1")

            result = _call_callback(
                db, order, "pay_abc123", _mock_client_with_status("captured")
            )

            assert KEY_SECRET not in str(result)
        finally:
            db.close()
