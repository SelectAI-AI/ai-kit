"""
Property test for the Access_Service gating decision correctness — Property 7.
Validates Requirements 8.4, 9.1, 9.2, 9.3, 9.4, 9.5
"""
from unittest.mock import patch

from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import pricing_catalog as cat
from app.access_service import can_access_slug
from app.database import Base
from app.models import Entitlement, Order, User


# All slugs covered by sellable kits (candidates for gated access checks) plus
# the capstone (covered only by the bundle, never by an individual kit) and a
# never-covered slug to exercise the "no kit covers it" denial branch.
_KIT_SLUGS = [
    slug
    for kit_id, entry in cat.KIT_CATALOG.items()
    if cat.is_purchasable(kit_id)
    for slug in entry["slugs"]
]
_CANDIDATE_SLUGS = _KIT_SLUGS + [cat.CAPSTONE_SLUG, "not-a-real-slug"]

# Sellable kit ids and the bundle — the selections an entitlement may snapshot.
_SELECTIONS = [kit_id for kit_id in cat.KIT_CATALOG if cat.is_purchasable(kit_id)] + [
    cat.BUNDLE_SELECTION
]


def _expected_required_kit_id(slug: str) -> str | None:
    """First kit in catalog order whose slugs include ``slug`` (mirror of Req 9.2)."""
    for kit_id, entry in cat.KIT_CATALOG.items():
        if slug in (entry.get("slugs") or []):
            return kit_id
    return None


# Feature: kit-pricing-and-payments, Property 7: Access-gating decision
# correctness — for any user and gated module slug, can_access_slug returns
# allow if and only if at least one exemption holds (user role is instructor,
# DEMO_MODE is enabled, or the slug is designated free) OR the user holds an
# active entitlement whose covered slugs include that slug; and whenever access
# is denied, the decision identifies the required_kit_id that would unlock the
# slug.
@given(
    role=st.sampled_from(["student", "instructor"]),
    slug=st.sampled_from(_CANDIDATE_SLUGS),
    demo_mode=st.booleans(),
    free=st.booleans(),
    entitlement_selection=st.one_of(st.none(), st.sampled_from(_SELECTIONS)),
    entitlement_active=st.booleans(),
)
@hyp_settings(max_examples=200, deadline=None)
def test_access_gating_decision_correctness(
    role, slug, demo_mode, free, entitlement_selection, entitlement_active
):
    """
    Property 7: Access-gating decision correctness.

    Allow iff an exemption holds (instructor, DEMO_MODE, free slug) OR an active
    entitlement covers the slug; when denied, a required_kit_id is identified
    (the first kit whose slugs cover the slug, else None).

    **Validates: Requirements 8.4, 9.1, 9.2, 9.3, 9.4, 9.5**
    """
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        user = User(
            id="u1",
            email="u@test.com",
            full_name="Test User",
            hashed_password="x",
            role=role,
        )
        db.add(user)
        db.commit()

        # Optionally seed one entitlement (active or inactive) snapshotting the
        # configured slugs for a selection, mirroring how a real grant records
        # coverage (Entitlement_Service snapshot semantics).
        covered_by_active_entitlement = False
        if entitlement_selection is not None:
            if entitlement_selection == cat.BUNDLE_SELECTION:
                snapshot = list(cat.bundle_slugs())
            else:
                snapshot = list(cat.get_kit(entitlement_selection).slugs)

            order = Order(
                id="o1",
                user_id=user.id,
                selection=entitlement_selection,
                amount_paise=1,
                status="paid",
            )
            db.add(order)
            db.commit()
            db.add(
                Entitlement(
                    id="e1",
                    user_id=user.id,
                    order_id=order.id,
                    selection=entitlement_selection,
                    slugs_csv=",".join(snapshot),
                    active=entitlement_active,
                )
            )
            db.commit()
            covered_by_active_entitlement = entitlement_active and slug in snapshot

        # Designate the slug free for this run when `free` is set (Req 9.5).
        free_slugs = {slug} if free else set()

        # Independently model each exemption so the oracle is derived from the
        # acceptance criteria, not from the implementation.
        instructor_exempt = role == "instructor"  # Req 9.3
        demo_exempt = demo_mode  # Req 9.4
        free_exempt = free  # Req 9.5 (slug is in free_slugs)

        expected_allowed = (
            instructor_exempt
            or demo_exempt
            or free_exempt
            or covered_by_active_entitlement
        )

        with patch("app.access_service.settings") as mock_settings, patch(
            "app.access_service.FREE_SLUGS", free_slugs
        ):
            mock_settings.demo_mode = demo_mode
            decision = can_access_slug(db, user, slug)

        # Biconditional: allow iff an exemption or active entitlement holds.
        assert decision.allowed == expected_allowed

        if decision.allowed:
            # No required kit is reported when access is granted.
            assert decision.required_kit_id is None
        else:
            # When denied, the decision identifies the kit that would unlock the
            # slug — the first catalog kit covering it, or None if none cover it
            # (e.g. the capstone or an unknown slug) (Req 9.2).
            assert decision.required_kit_id == _expected_required_kit_id(slug)
    finally:
        db.close()
