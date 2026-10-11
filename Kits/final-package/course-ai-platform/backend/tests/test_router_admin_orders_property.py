"""Property test for the College bulk user-limit boundary — Property 8.

# Feature: kit-pricing-and-payments, Property 8: College bulk user-limit boundary
# — creating a College bulk order succeeds with flat 499900 paise covering all
# sellable slugs iff the list has at most 1000 users; over 1000 is rejected with
# no order created.

Exercises ``POST /api/admin/orders/college`` (``create_college_order``) via a
direct route-function call against an in-memory SQLite session and an instructor
user, following the existing router property-test pattern. User-list sizes are
generated around the 1000-user boundary (0..1200).

**Validates: Requirements 10.1, 10.2, 10.3**
"""

from fastapi import HTTPException
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Order, User
from app.pricing_catalog import BUNDLE_SELECTION, bundle_slugs
from app.routers.admin_orders import (
    BULK_FLAT_PAISE,
    COLLEGE_MAX_USERS,
    create_college_order,
)
from app.schemas import BulkOrderIn


def _fresh_session():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return engine, Session()


# Sizes concentrated around the 1000-user boundary (0..1200). ``user_ids`` are
# distinct string ids so the per-user entitlement grant stays well-formed.
@given(size=st.integers(min_value=0, max_value=1200))
@hyp_settings(max_examples=100, deadline=None)
def test_college_bulk_user_limit_boundary(size):
    """len<=1000 -> order created (flat 499900 paise, bundle coverage);
    len>1000 -> 400 and no Order row persisted.

    **Validates: Requirements 10.1, 10.2, 10.3**
    """
    engine, db = _fresh_session()
    try:
        instructor = User(
            id="admin1",
            email="admin@test.com",
            full_name="Admin",
            hashed_password="x",
            role="instructor",
        )
        db.add(instructor)
        db.commit()

        user_ids = [f"u{i}" for i in range(size)]
        payload = BulkOrderIn(user_ids=user_ids)

        if size <= COLLEGE_MAX_USERS:
            # Within the limit: order succeeds (Req 10.1, 10.2).
            result = create_college_order(payload, db=db, instructor=instructor)

            orders = db.query(Order).all()
            assert len(orders) == 1, "exactly one college order should be created"
            order = orders[0]

            # Flat 499900 paise covering all sellable slugs (Req 10.1).
            assert order.amount_paise == BULK_FLAT_PAISE == 499900
            assert order.kind == "college"
            assert order.currency == "INR"
            assert order.selection == BUNDLE_SELECTION
            assert order.status == "created"

            # Entitlement snapshot covers exactly all sellable slugs + capstone.
            expected_slugs = set(bundle_slugs())
            granted = result if isinstance(result, list) else [result]
            assert len(granted) == size
            for ent in granted:
                assert set(ent.slugs_csv.split(",")) - {""} == expected_slugs
        else:
            # Over the limit: rejected with 400 and no order created (Req 10.3).
            raised = False
            try:
                create_college_order(payload, db=db, instructor=instructor)
            except HTTPException as exc:
                raised = True
                assert exc.status_code == 400
            assert raised, "a list exceeding 1000 users must be rejected"
            assert db.query(Order).count() == 0, "no order should be persisted"
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
