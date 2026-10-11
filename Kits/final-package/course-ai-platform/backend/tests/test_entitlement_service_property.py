"""
Property test for entitlement coverage snapshot (Entitlement_Service) — Property 6.
Validates Requirements 8.1, 8.2, 8.3, 10.5
"""
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import pricing_catalog as cat
from app.database import Base
from app.entitlement_service import grant_for_order
from app.models import Order, User

# Sellable kit ids plus the bundle form the valid selection space.
_SELLABLE_KITS = [kid for kid in cat.KIT_CATALOG if cat.is_purchasable(kid)]
_SELECTIONS = _SELLABLE_KITS + [cat.BUNDLE_SELECTION]


def _expected_slugs(selection: str) -> set[str]:
    """Configured slugs for a selection: kit slugs, or bundle_slugs() for the bundle."""
    if selection == cat.BUNDLE_SELECTION:
        return set(cat.bundle_slugs())
    return set(cat.get_kit(selection).slugs)


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


# Feature: kit-pricing-and-payments, Property 6: Entitlement coverage matches
# selection snapshot — for any paid order (individual kit or bundle), each
# granted active entitlement records the user id, the selection, and the
# originating order id, and its snapshot of covered slugs equals exactly the
# configured slugs for that selection (a kit's slugs; or for the bundle, all
# sellable slugs plus the capstone).
@given(selection=st.sampled_from(_SELECTIONS))
@hyp_settings(max_examples=100, deadline=None)
def test_entitlement_coverage_matches_selection_snapshot(selection):
    """
    Property 6: Entitlement coverage matches selection snapshot.

    **Validates: Requirements 8.1, 8.2, 8.3, 10.5**
    """
    db = _make_session()
    try:
        user = User(
            id="user-1",
            email="buyer@test.com",
            full_name="Buyer",
            hashed_password="x",
        )
        db.add(user)
        db.commit()

        order = Order(
            user_id=user.id,
            selection=selection,
            kind="individual",
            amount_paise=cat.base_price_paise(selection),
            currency="INR",
            status="paid",
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        entitlement = grant_for_order(db, order)

        # Records user id, selection, and originating order id (Req 8.1, 8.3).
        assert entitlement.user_id == user.id
        assert entitlement.selection == selection
        assert entitlement.order_id == order.id
        assert entitlement.active is True

        # Snapshot of covered slugs equals exactly the configured slugs for the
        # selection — kit slugs for a kit; all sellable slugs plus the capstone
        # for the bundle (Req 8.1, 8.2).
        snapshot = set(s for s in entitlement.slugs_csv.split(",") if s)
        assert snapshot == _expected_slugs(selection)
    finally:
        db.close()
