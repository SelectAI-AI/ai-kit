"""Property test for the discount request lifecycle and single-pending invariant — Property 10.

# Feature: kit-pricing-and-payments, Property 10: Discount request lifecycle and
# single-pending invariant — valid submission creates a queryable `pending`
# request; a second submission while pending is rejected with no change; approve
# at `student_t1`/`student_t2` sets `approved` and the student's tier (other tiers
# rejected, state unchanged); reject sets `rejected` leaving tier `none`.

Exercises the discount router functions directly against an in-memory SQLite
session, following the existing router property-test pattern:
  - student: ``submit_discount_request`` / ``my_discount_request``
  - admin:   ``approve_discount_request`` / ``reject_discount_request``

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4**
"""

from fastapi import HTTPException
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import DiscountRequest, User
from app.routers.discounts import (
    ALLOWED_APPROVAL_TIERS,
    approve_discount_request,
    my_discount_request,
    reject_discount_request,
    submit_discount_request,
)
from app.schemas import DiscountRequestIn


def _fresh_session():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return engine, Session()


def _seed_users(db):
    student = User(
        id="student1",
        email="student@test.com",
        full_name="Student",
        hashed_password="x",
        role="student",
    )
    admin = User(
        id="admin1",
        email="admin@test.com",
        full_name="Admin",
        hashed_password="x",
        role="instructor",
    )
    db.add_all([student, admin])
    db.commit()
    return student, admin


# A resolution action after approval/reject: either approve at some tier, or reject.
# ``tier`` spans valid approval tiers plus invalid values (incl. empty / arbitrary).
_tiers = st.sampled_from(
    sorted(ALLOWED_APPROVAL_TIERS) + ["", "none", "corporate", "college", "bogus_tier"]
)


@given(
    details=st.text(max_size=50),
    action=st.sampled_from(["approve", "reject"]),
    tier=_tiers,
)
@hyp_settings(max_examples=100, deadline=None)
def test_discount_request_lifecycle_and_single_pending(details, action, tier):
    """Full lifecycle: submit -> pending (queryable); second submit while pending
    -> 400 no change; approve valid tier -> approved + student tier set; approve
    invalid tier -> 400 state unchanged; reject -> rejected, tier stays none.

    **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4**
    """
    engine, db = _fresh_session()
    try:
        student, admin = _seed_users(db)

        # --- Submit: creates a queryable pending request (Req 2.1, 2.2, 2.4) ---
        created = submit_discount_request(
            DiscountRequestIn(details=details), db=db, user=student
        )
        assert created.status == "pending"
        assert created.user_id == student.id

        # Queryable by its stored status via the student status endpoint (Req 2.4).
        queried = my_discount_request(db=db, user=student)
        assert queried.id == created.id
        assert queried.status == "pending"

        assert db.query(DiscountRequest).count() == 1
        # Student's tier is untouched by submission.
        assert student.discount_tier == "none"

        # --- Single-pending invariant: a 2nd submission is rejected (Req 2.3) ---
        raised = False
        try:
            submit_discount_request(
                DiscountRequestIn(details="second"), db=db, user=student
            )
        except HTTPException as exc:
            raised = True
            assert exc.status_code == 400
            # Error identifies the existing pending request (Req 2.3).
            assert created.id in str(exc.detail)
        assert raised, "a second submission while pending must be rejected"
        # No new request row and the existing one is unchanged.
        assert db.query(DiscountRequest).count() == 1
        db.refresh(created)
        assert created.status == "pending"

        request_id = created.id

        if action == "approve":
            if tier in ALLOWED_APPROVAL_TIERS:
                # Approve with a valid tier -> approved + student tier set (Req 3.2).
                result = approve_discount_request(
                    request_id, tier, db=db, admin=admin
                )
                assert result.status == "approved"
                assert result.granted_tier == tier
                db.refresh(student)
                assert student.discount_tier == tier

                # Status is reflected through the student status query (Req 2.4).
                me = my_discount_request(db=db, user=student)
                assert me.status == "approved"
                assert me.granted_tier == tier
            else:
                # Approve with an invalid tier -> 400, state unchanged (Req 3.3).
                raised = False
                try:
                    approve_discount_request(request_id, tier, db=db, admin=admin)
                except HTTPException as exc:
                    raised = True
                    assert exc.status_code == 400
                assert raised, f"invalid tier {tier!r} must be rejected"
                db.refresh(created)
                db.refresh(student)
                assert created.status == "pending"
                assert created.granted_tier is None
                assert student.discount_tier == "none"
        else:
            # Reject -> rejected, student's tier left as none (Req 3.4).
            result = reject_discount_request(request_id, db=db, admin=admin)
            assert result.status == "rejected"
            db.refresh(student)
            assert student.discount_tier == "none"

            me = my_discount_request(db=db, user=student)
            assert me.status == "rejected"
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
