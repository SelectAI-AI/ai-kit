"""The LAUNCHOFFER coupon and the instructor notebook bypass.

The coupon replaces the list price with a fixed INR price (₹2,999 per kit, ₹9,996
for the bundle). The server checks the code, a coupon never stacks with a tier
discount, and an invalid code is rejected rather than ignored. Routes are called
directly against an in-memory SQLite session with ``razorpay.Client`` patched.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import pricing_catalog as cat
from app.database import Base
from app.models import Order, User
from app.pricing_service import compute_price_minor
from app.routers import modules, payments, pricing
from app.schemas import CouponApplyIn, OrderCreateIn

KITS = ["kit1", "kit2", "kit3", "kit4"]


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


def _order(db, user, **fields):
    """Create an order through the route with Razorpay mocked; returns (result, client mock)."""
    mock_client = MagicMock()
    mock_client.order.create.return_value = {"id": "order_test_1"}
    with patch.object(payments.settings, "razorpay_key_id", "rzp_test_key"), \
            patch.object(payments.settings, "razorpay_key_secret", "super_secret"), \
            patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
        result = payments.create_order(OrderCreateIn(**fields), db=db, user=user)
    return result, mock_client


# --- Prices ---------------------------------------------------------------------

def test_the_inr_bundle_list_price_is_the_sum_of_four_kits():
    assert cat.BUNDLE_PRICES_MINOR["INR"] == 3999600           # ₹39,996
    assert cat.BUNDLE_PRICES_MINOR["INR"] == 4 * cat.KIT_PRICES_MINOR["INR"]["kit1"]


@pytest.mark.parametrize("kit", KITS)
def test_without_a_code_a_kit_costs_the_list_price(kit):
    assert compute_price_minor(kit, "none", "INR") == 999900    # ₹9,999


@pytest.mark.parametrize("kit", KITS)
@pytest.mark.parametrize("typed", ["LAUNCHOFFER", "launchoffer", "  LaunchOffer  "])
def test_launchoffer_makes_a_kit_2999_in_any_case(kit, typed):
    assert compute_price_minor(kit, "none", "INR", typed) == 299900   # ₹2,999


def test_launchoffer_makes_the_bundle_9996():
    assert compute_price_minor(cat.BUNDLE_SELECTION, "none", "INR", "LAUNCHOFFER") == 999600


def test_the_offer_prices_are_70_and_75_percent_off():
    offer = pricing.check_coupon(CouponApplyIn(code="LAUNCHOFFER", currency="INR"))
    assert offer.code == "LAUNCHOFFER"
    assert offer.prices["kit1"] == 299900 and offer.prices["bundle"] == 999600
    assert offer.percent_off == {"kit1": 70, "kit2": 70, "kit3": 70, "kit4": 70, "bundle": 75}
    assert "Early bird" in offer.label


def test_a_coupon_never_stacks_with_the_student_discount():
    # A student's 35% price is ₹6,499, the coupon price is ₹2,999: the lower one wins.
    assert compute_price_minor("kit1", "student_t1", "INR") == 649900
    assert compute_price_minor("kit1", "student_t1", "INR", "LAUNCHOFFER") == 299900


def test_a_coupon_never_raises_the_price():
    # Bulk 50% would be ₹4,999; the coupon is cheaper, so it wins. Anything dearer would lose.
    assert compute_price_minor("kit1", "corporate", "INR", "LAUNCHOFFER") == 299900


# --- Invalid codes ----------------------------------------------------------------

@pytest.mark.parametrize("code", ["BOGUS", "LAUNCH", "LAUNCHOFFER2"])
def test_an_unknown_code_is_rejected_not_ignored(code):
    with pytest.raises(cat.InvalidCoupon):
        compute_price_minor("kit1", "none", "INR", code)
    with pytest.raises(HTTPException) as exc:
        pricing.check_coupon(CouponApplyIn(code=code, currency="INR"))
    assert exc.value.status_code == 400


def test_the_code_does_not_apply_to_usd_prices():
    with pytest.raises(cat.InvalidCoupon):
        compute_price_minor("kit1", "none", "USD", "LAUNCHOFFER")
    with pytest.raises(HTTPException) as exc:
        pricing.check_coupon(CouponApplyIn(code="LAUNCHOFFER", currency="USD"))
    assert exc.value.status_code == 400 and "USD" in exc.value.detail


def test_switching_the_offer_off_ends_it(monkeypatch):
    monkeypatch.setitem(cat.LAUNCH_COUPON, "enabled", False)
    assert cat.coupons_enabled() is False
    with pytest.raises(cat.InvalidCoupon):
        compute_price_minor("kit1", "none", "INR", "LAUNCHOFFER")


def test_the_public_catalog_says_coupons_exist_but_never_lists_the_code():
    catalog = pricing.get_catalog()
    assert catalog.coupons_enabled is True
    assert "LAUNCHOFFER" not in catalog.model_dump_json().upper()


# --- Orders ---------------------------------------------------------------------

def test_an_order_with_the_code_is_charged_the_offer_price_and_records_the_code():
    db = _make_session()
    try:
        buyer = _buyer(db)
        result, client = _order(db, buyer, selection="kit2", currency="INR", coupon_code="launchoffer")

        assert result.amount_paise == 299900 and result.currency == "INR"
        client.order.create.assert_called_once_with({"amount": 299900, "currency": "INR"})
        order = db.query(Order).one()
        assert (order.amount_paise, order.coupon_code) == (299900, "LAUNCHOFFER")
    finally:
        db.close()


def test_the_bundle_with_the_code_costs_9996():
    db = _make_session()
    try:
        result, _ = _order(db, _buyer(db), selection="bundle", currency="INR", coupon_code="LAUNCHOFFER")
        assert result.amount_paise == 999600
    finally:
        db.close()


def test_an_order_without_a_code_is_the_list_price():
    db = _make_session()
    try:
        result, _ = _order(db, _buyer(db), selection="kit1", currency="INR")
        assert result.amount_paise == 999900
        assert db.query(Order).one().coupon_code is None
    finally:
        db.close()


@pytest.mark.parametrize("fields", [
    {"selection": "kit1", "currency": "INR", "coupon_code": "WRONG"},
    {"selection": "kit1", "currency": "USD", "coupon_code": "LAUNCHOFFER"},
])
def test_an_order_with_a_bad_code_is_rejected_before_razorpay_and_creates_nothing(fields):
    db = _make_session()
    try:
        buyer = _buyer(db)
        mock_client = MagicMock()
        with patch.object(payments.settings, "razorpay_key_id", "rzp_test_key"), \
                patch.object(payments.settings, "razorpay_key_secret", "super_secret"), \
                patch.object(payments.razorpay, "Client", lambda auth=None: mock_client):
            with pytest.raises(HTTPException) as exc:
                payments.create_order(OrderCreateIn(**fields), db=db, user=buyer)

        assert exc.value.status_code == 400
        mock_client.order.create.assert_not_called()
        assert db.query(Order).count() == 0
    finally:
        db.close()


def test_a_client_cannot_name_its_own_price():
    # The request has no amount field at all; extra keys are dropped.
    body = OrderCreateIn.model_validate(
        {"selection": "kit1", "currency": "INR", "amount": 1, "amount_paise": 1, "price": 1}
    )
    assert not hasattr(body, "amount") and not hasattr(body, "price")


# --- Instructors can open every notebook ----------------------------------------------

def test_instructors_and_demo_mode_see_all_notebooks_but_students_do_not():
    instructor = SimpleNamespace(role="instructor")
    student = SimpleNamespace(role="student")
    assert modules._sees_all_notebooks(instructor) is True
    assert modules._sees_all_notebooks(student) is False
    with patch.object(modules.settings, "demo_mode", True):
        assert modules._sees_all_notebooks(student) is True


def test_an_instructor_skips_the_notebook_lock_check_entirely():
    # If the lock check ran it would look up the module; make that blow up to prove it does not.
    boom = MagicMock()
    boom.get_module_manifest.side_effect = AssertionError("lock check ran for an instructor")
    with patch.object(modules, "cs", boom):
        modules._assert_unlocked(None, SimpleNamespace(role="instructor", id="i1"), "MCP", "lab1.ipynb")


def test_a_student_still_hits_the_lock_check():
    boom = MagicMock()
    boom.get_module_manifest.return_value = None          # module missing -> 404 proves the check ran
    with patch.object(modules, "cs", boom):
        with pytest.raises(HTTPException) as exc:
            modules._assert_unlocked(None, SimpleNamespace(role="student", id="s1"), "MCP", "lab1.ipynb")
    assert exc.value.status_code == 404
