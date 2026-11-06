"""Multi-currency pricing (USD + INR) for the selectAi pricing page.

Covers the per-currency catalog, percent-based discount tiers, the public catalog
payload, and ``POST /api/payments/order`` charging in the chosen currency. Routes
are called directly against an in-memory SQLite session, and ``razorpay.Client``
is patched on the router module, matching the other payment tests.
"""

from unittest.mock import MagicMock, patch

import pytest
import razorpay
from fastapi import HTTPException
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import pricing_catalog as cat
from app.database import Base
from app.models import Order, User
from app.pricing_service import TIER_PERCENT_OFF, compute_price_minor, compute_price_paise
from app.routers import payments, pricing
from app.schemas import OrderCreateIn

_SELLABLE_KITS = [kid for kid in cat.KIT_CATALOG if cat.is_purchasable(kid)]
_TIERS = list(TIER_PERCENT_OFF)


def _make_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _buyer(db, tier="none"):
    user = User(id="buyer-1", email="buyer@test.com", full_name="Buyer",
                hashed_password="x", discount_tier=tier)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_order(db, user, payload, order_create):
    mock_client = MagicMock()
    mock_client.order.create.side_effect = order_create
    with patch.object(payments.settings, "razorpay_key_id", "rzp_test_key"), \
            patch.object(payments.settings, "razorpay_key_secret", "super_secret"), \
            patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
        return payments.create_order(payload, db=db, user=user), mock_client


# --- Catalog and price table -----------------------------------------------

@pytest.mark.parametrize("kit_id, cents", [("kit1", 6900), ("kit2", 7900), ("kit3", 2900), ("kit4", 3900)])
def test_usd_kit_list_prices_match_the_selectai_page(kit_id, cents):
    assert cat.price_minor(kit_id, "USD") == cents
    assert compute_price_minor(kit_id, "none", "USD") == cents


def test_usd_bundle_price_is_199_dollars_for_every_tier():
    for tier in _TIERS:
        assert compute_price_minor(cat.BUNDLE_SELECTION, tier, "USD") == 19900


def test_inr_prices_are_the_usd_prices_converted_at_the_configured_rate():
    # $69 at ₹95 per dollar is ₹6,555; tiers take a percentage off and round down to a whole rupee.
    assert cat.USD_TO_INR_RATE == 95
    assert compute_price_minor("kit1", "none", "INR") == 655500
    assert compute_price_minor("kit1", "student_t1", "INR") == 426000   # ₹4,260.75 -> ₹4,260
    assert compute_price_minor("kit1", "student_t2", "INR") == 327700   # ₹3,277.50 -> ₹3,277
    assert compute_price_minor(cat.BUNDLE_SELECTION, "none", "INR") == 1890500   # $199 -> ₹18,905


def test_usd_student_tiers_take_a_percentage_off_and_round_down_to_a_whole_dollar():
    # $69 * 65% = $44.85 -> $44 ; $69 * 50% = $34.50 -> $34
    assert compute_price_minor("kit1", "student_t1", "USD") == 4400
    assert compute_price_minor("kit1", "student_t2", "USD") == 3400


def test_kit_without_a_usd_price_and_unknown_currency_raise_key_error():
    with pytest.raises(KeyError):
        compute_price_minor("kit5", "none", "USD")
    with pytest.raises(KeyError):
        compute_price_minor("kit1", "none", "EUR")


@given(
    kit=st.sampled_from(_SELLABLE_KITS),
    tier=st.sampled_from(_TIERS),
    currency=st.sampled_from(cat.SUPPORTED_CURRENCIES),
)
@hyp_settings(max_examples=100, deadline=None)
def test_discounted_price_never_exceeds_list_and_is_a_whole_unit(kit, tier, currency):
    list_price = cat.price_minor(kit, currency)
    price = compute_price_minor(kit, tier, currency)
    assert price <= list_price
    assert price % 100 == 0
    if tier == "none":
        assert price == list_price
    # The original INR entry point is the INR case of the general function.
    assert compute_price_paise(kit, tier) == compute_price_minor(kit, tier, "INR")


def test_catalog_endpoint_lists_prices_for_every_currency():
    data = pricing.get_catalog().model_dump()
    assert data["currencies"] == list(cat.SUPPORTED_CURRENCIES)
    assert data["default_currency"] == cat.DEFAULT_CURRENCY
    assert data["bundle_prices"]["USD"] == 19900
    kits = {k["kit_id"]: k for k in data["kits"]}
    assert kits["kit2"]["prices"]["USD"] == 7900
    assert kits["kit2"]["name"] == "Agentic AI & Guardrails"
    # Legacy INR fields are still served for older clients.
    assert kits["kit1"]["base_price_paise"] == 655500
    assert kits["kit1"]["prices"]["INR"] == 655500
    assert data["bundle_base_paise"] == 1890500
    assert data["bundle_prices"]["INR"] == 1890500
    # kit5 is not purchasable and has no USD price.
    assert "USD" not in kits["kit5"]["prices"]


# --- Orders in a chosen currency ----------------------------------------------

def test_order_in_usd_charges_the_usd_price_and_stores_the_currency():
    db = _make_session()
    try:
        buyer = _buyer(db, tier="student_t1")
        captured = {}

        def order_create(body):
            captured.update(body)
            return {"id": "order_usd_1"}

        payload = OrderCreateIn.model_validate({"selection": "kit1", "currency": "USD", "amount": 1})
        result, _ = _create_order(db, buyer, payload, order_create)

        assert captured == {"amount": 4400, "currency": "USD"}
        assert result.amount_paise == 4400
        assert result.currency == "USD"
        order = db.query(Order).one()
        assert (order.amount_paise, order.currency, order.discount_tier) == (4400, "USD", "student_t1")
    finally:
        db.close()


def test_order_without_a_currency_still_defaults_to_inr():
    db = _make_session()
    try:
        buyer = _buyer(db)
        payload = OrderCreateIn.model_validate({"selection": "kit1"})
        result, mock_client = _create_order(db, buyer, payload, lambda body: {"id": "order_inr_1"})

        assert result.currency == "INR"
        assert result.amount_paise == 655500
        mock_client.order.create.assert_called_once_with({"amount": 655500, "currency": "INR"})
    finally:
        db.close()


def test_order_in_an_unsupported_currency_is_rejected_before_calling_razorpay():
    db = _make_session()
    try:
        buyer = _buyer(db)
        payload = OrderCreateIn.model_validate({"selection": "kit1", "currency": "EUR"})
        mock_client = MagicMock()
        with patch.object(payments.settings, "razorpay_key_id", "rzp_test_key"), \
                patch.object(payments.settings, "razorpay_key_secret", "super_secret"), \
                patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
            with pytest.raises(HTTPException) as exc:
                payments.create_order(payload, db=db, user=buyer)

        assert exc.value.status_code == 400
        mock_client.order.create.assert_not_called()
        assert db.query(Order).count() == 0
    finally:
        db.close()


def test_provider_rejecting_the_currency_returns_502_without_echoing_the_provider_error():
    db = _make_session()
    try:
        buyer = _buyer(db)
        payload = OrderCreateIn.model_validate({"selection": "kit1", "currency": "USD"})

        def order_create(body):
            raise razorpay.errors.BadRequestError("provider-internal-detail")

        with pytest.raises(HTTPException) as exc:
            _create_order(db, buyer, payload, order_create)

        assert exc.value.status_code == 502
        assert "provider-internal-detail" not in str(exc.value.detail)
        assert "super_secret" not in str(exc.value.detail)
        assert db.query(Order).count() == 0
    finally:
        db.close()
