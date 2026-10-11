"""Property test for server-authoritative order amount (Payment_Service) — Property 2.

# Feature: kit-pricing-and-payments, Property 2: Amount is server-authoritative on
# order creation — for any selection, buyer discount tier, and any arbitrary
# client-supplied amount value included in the request, the persisted
# Order.amount_paise and the amount passed to Razorpay order creation both equal
# compute_price_paise(selection, tier), the currency is always "INR", and the
# created order links the buyer, selection, applied tier, Razorpay order id, and
# status="created" — never a client-supplied amount.

Exercises ``POST /api/payments/order`` (``create_order``) via a direct
route-function call against an in-memory SQLite session. ``razorpay.Client`` is
patched at ``app.routers.payments.razorpay.Client`` so ``order.create`` returns a
generated id and CAPTURES the amount argument it was invoked with. Razorpay
credentials are forced on by monkeypatching the ``settings`` singleton used by the
router. Selection is drawn from the sellable kits plus the bundle; the buyer's
``discount_tier`` is drawn from every supported tier; an arbitrary client-supplied
amount is attached to the request to prove it is ignored.

**Validates: Requirements 4.7, 5.1, 5.2, 5.3, 4.8**
"""

from unittest.mock import MagicMock, patch

from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import pricing_catalog as cat
from app.database import Base
from app.models import Order, User
from app.pricing_service import compute_price_paise
from app.routers import payments
from app.schemas import OrderCreateIn

# Sellable kit ids plus the bundle form the valid selection space.
_SELLABLE_KITS = [kid for kid in cat.KIT_CATALOG if cat.is_purchasable(kid)]
_SELECTIONS = _SELLABLE_KITS + [cat.BUNDLE_SELECTION]

# Every discount tier the pricing table understands.
_TIERS = ["none", "student_t1", "student_t2", "corporate", "college"]


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


# Feature: kit-pricing-and-payments, Property 2: Amount is server-authoritative on
# order creation.
@given(
    selection=st.sampled_from(_SELECTIONS),
    tier=st.sampled_from(_TIERS),
    # Arbitrary client-supplied amount (incl. negative/huge/zero) that must be
    # ignored entirely by the server.
    client_amount=st.integers(min_value=-(10**9), max_value=10**9),
)
@hyp_settings(max_examples=100, deadline=None)
def test_order_amount_is_server_authoritative(selection, tier, client_amount):
    """
    Property 2: Amount is server-authoritative on order creation.

    **Validates: Requirements 4.7, 5.1, 5.2, 5.3, 4.8**
    """
    db = _make_session()
    try:
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

        # Patch razorpay.Client so order.create returns a generated id and
        # CAPTURES the exact dict it was called with (the amount sent to Razorpay).
        captured = {}
        generated_order_id = f"order_{selection}_{tier}"

        def _order_create(order_payload):
            captured["payload"] = order_payload
            return {"id": generated_order_id}

        mock_client = MagicMock()
        mock_client.order.create.side_effect = _order_create

        # The request carries only a selection (the schema has no amount field),
        # so any client-supplied amount is structurally ignored. We still prove
        # intent by constructing the payload from a dict that includes a bogus
        # client amount, which Pydantic drops.
        payload = OrderCreateIn.model_validate(
            {"selection": selection, "amount_paise": client_amount, "amount": client_amount}
        )

        # Context-managed patches avoid the function-scoped-fixture health check:
        # force credentials on (key id surfaces in the response, secret never
        # leaks) and swap in the capturing Razorpay client.
        with patch.object(payments.settings, "razorpay_key_id", "rzp_test_key"), \
                patch.object(payments.settings, "razorpay_key_secret", "super_secret"), \
                patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
            result = payments.create_order(payload, db=db, user=buyer)

        expected = compute_price_paise(selection, tier)

        # The amount sent to Razorpay equals the server-computed amount in INR
        # (Req 5.1), never the client-supplied amount (Req 4.7).
        assert captured["payload"]["amount"] == expected
        assert captured["payload"]["currency"] == "INR"
        assert captured["payload"]["amount"] != client_amount or expected == client_amount

        # The response carries the server-authoritative amount, INR, the Razorpay
        # order id and the key id only — never the secret (Req 5.3, 4.8).
        assert result.amount_paise == expected
        assert result.currency == "INR"
        assert result.razorpay_order_id == generated_order_id
        assert result.key_id == "rzp_test_key"
        assert "super_secret" not in result.model_dump_json()

        # Exactly one order persisted, linking buyer / selection / tier /
        # razorpay order id / status="created" with the server amount (Req 5.2).
        orders = db.query(Order).all()
        assert len(orders) == 1
        order = orders[0]
        assert order.amount_paise == expected
        assert order.currency == "INR"
        assert order.user_id == buyer.id
        assert order.selection == selection
        assert order.discount_tier == tier
        assert order.razorpay_order_id == generated_order_id
        assert order.status == "created"
    finally:
        db.close()
