"""END-TO-END INTEGRATION TEST — Task 17.2.

Full purchase-to-access flow stitched together across the real Payment_Service,
Entitlement_Service, and Access_Service against a single in-memory SQLite
session:

    create order  ->  (before payment) gated slug is DENIED
                  ->  verified Standard Checkout callback
                  ->  server-side payment.fetch mocked to "captured"
                  ->  entitlement granted
                  ->  (after payment) the purchased kit's slug is ACCESSIBLE

Only the two unavoidable Razorpay network calls are mocked:
``order.create`` (returns a fixed order id) and ``payment.fetch`` (returns
``{"status": "captured"}``). The callback signature is produced with the real
pure helper ``razorpay_signatures.callback_signature``. Access gating is driven
by ``access_service.can_access_slug`` with ``DEMO_MODE`` forced off so the gate
actually applies.

**Validates: Requirements 8.4, 9.1**
"""

from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import access_service
from app.database import Base
from app.models import Entitlement, Order, User
from app.pricing_catalog import get_kit
from app.razorpay_signatures import callback_signature
from app.routers import payments
from app.schemas import CallbackIn, OrderCreateIn

KEY_ID = "rzp_test_key_id"
KEY_SECRET = "super_secret_value_do_not_leak"

# A slug covered by kit1 ("Foundations" -> fundamentals, db, rag-engineering).
GATED_SLUG = "fundamentals"


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


def _seed_student(db):
    """A plain student (role defaults to 'student', tier 'none') — no exemptions."""
    student = User(
        id="student-e2e",
        email="student-e2e@test.com",
        full_name="E2E Student",
        hashed_password="x",
        role="student",
        discount_tier="none",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def test_end_to_end_order_to_entitlement_to_access():
    """Order -> verified captured callback -> entitlement -> gated slug accessible.

    **Validates: Requirements 8.4, 9.1**
    """
    db = _make_session()
    try:
        # GATED_SLUG must truly belong to kit1 for this test to be meaningful.
        assert GATED_SLUG in get_kit("kit1").slugs

        student = _seed_student(db)

        # Razorpay client mock: order.create returns a fixed id; payment.fetch
        # returns a captured status. These are the only mocked network calls.
        mock_client = MagicMock()
        mock_client.order.create.return_value = {"id": "order_e2e"}
        mock_client.payment.fetch.return_value = {"status": "captured", "id": "pay_e2e"}

        with patch.object(payments.settings, "razorpay_key_id", KEY_ID), \
                patch.object(payments.settings, "razorpay_key_secret", KEY_SECRET), \
                patch.object(payments.razorpay, "Client", lambda auth=None: mock_client), \
                patch.object(access_service.settings, "demo_mode", False):

            # --- Step 1: create the order for kit1 ---------------------------
            order_out = payments.create_order(
                OrderCreateIn(selection="kit1"), db=db, user=student
            )
            assert order_out.razorpay_order_id == "order_e2e"
            assert order_out.currency == "INR"

            # --- Step 2: BEFORE payment the gated slug is DENIED (Req 9.1) ---
            before = access_service.can_access_slug(db, student, GATED_SLUG)
            assert before.allowed is False, "slug must be gated before purchase"
            assert before.required_kit_id == "kit1", (
                "denied decision must point the buyer to the kit that unlocks the slug"
            )

            # --- Step 3: verified callback + captured fetch confirm payment --
            signature = callback_signature("order_e2e", "pay_e2e", KEY_SECRET)
            callback = CallbackIn(
                razorpay_order_id="order_e2e",
                razorpay_payment_id="pay_e2e",
                razorpay_signature=signature,
            )
            result = payments.confirm_callback(callback, db=db)
            assert result == {"verified": True}

            # The server-side status fetch actually happened.
            mock_client.payment.fetch.assert_called_once_with("pay_e2e")

            # --- Step 4: order is paid and an entitlement was granted (Req 8.4)
            order = (
                db.query(Order)
                .filter(Order.razorpay_order_id == "order_e2e")
                .one()
            )
            assert order.status == "paid"

            ents = (
                db.query(Entitlement)
                .filter(
                    Entitlement.user_id == student.id,
                    Entitlement.active.is_(True),
                )
                .all()
            )
            assert len(ents) == 1, "a captured confirmation grants exactly one entitlement"
            assert ents[0].selection == "kit1"
            assert GATED_SLUG in ents[0].slugs_csv.split(",")

            # --- Step 5: AFTER payment the gated slug is ACCESSIBLE (Req 8.4, 9.1)
            after = access_service.can_access_slug(db, student, GATED_SLUG)
            assert after.allowed is True, (
                "the granted entitlement must make the purchased kit's slug accessible"
            )
            assert after.required_kit_id is None
    finally:
        db.close()
