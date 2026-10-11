"""
Property test for corporate per-seat pricing (Admin bulk orders) — Property 9.
Validates Requirements 10.4
"""
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Order, User
from app.routers.admin_orders import BULK_FLAT_PAISE, create_corporate_order
from app.schemas import BulkOrderIn


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


# Feature: kit-pricing-and-payments, Property 9: Corporate per-seat pricing —
# for any positive seat count N, a Corporate bulk order records an amount equal
# to 499900 * N paise.
@given(seats=st.integers(min_value=1, max_value=1000))
@hyp_settings(max_examples=100, deadline=None)
def test_corporate_order_amount_is_flat_price_per_seat(seats):
    """
    Property 9: Corporate per-seat pricing.

    **Validates: Requirements 10.4**
    """
    db = _make_session()
    try:
        # An instructor user authorizes the admin bulk-order route (require_instructor).
        instructor = User(
            id="instructor-1",
            email="admin@test.com",
            full_name="Admin",
            hashed_password="x",
            role="instructor",
        )
        db.add(instructor)
        db.commit()

        # Call the route function directly with an instructor user. user_ids is
        # empty so no entitlements are granted; the property concerns the
        # persisted order amount only.
        payload = BulkOrderIn(user_ids=[], seats=seats)
        create_corporate_order(payload=payload, db=db, instructor=instructor)

        # Exactly one corporate order was persisted; its amount is 499900 * N paise.
        order = db.query(Order).filter(Order.kind == "corporate").one()
        assert order.amount_paise == BULK_FLAT_PAISE * seats
        assert order.amount_paise == 499900 * seats
        assert order.currency == "INR"
    finally:
        db.close()
