"""Example tests for admin discount authorization — Task 11.4.

Covers two example-level behaviours of the admin discount endpoints in
``app/routers/discounts.py`` (all guarded by ``require_instructor``):

1. Admin list shape (Req 3.1): ``GET /api/discounts/requests`` as an instructor
   returns a list of request shapes, each exposing ``status`` and ``user_id``.
2. Non-admin authorization (Req 3.5): a student calling the admin approve/reject
   endpoints is rejected with ``403`` and the targeted request's status — and the
   submitting student's discount tier — are left unchanged.

Uses FastAPI ``TestClient`` with dependency overrides: ``get_db`` is backed by an
in-memory SQLite session and ``get_current_user`` is overridden to simulate the
acting user (instructor or student). The discounts router is mounted on a local
``FastAPI`` app so the test is self-contained and independent of global router
registration (task 13.1).

**Validates: Requirements 3.1, 3.5**
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import DiscountRequest, User
from app.routers import discounts


def _make_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


class _AdminDiscountTestBase:
    def setup_method(self):
        self.engine = _make_engine()
        # expire_on_commit=False keeps seeded instances' attributes populated
        # after commit so the overridden get_current_user can return a usable
        # (detached) User without triggering a lazy DB reload.
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine, expire_on_commit=False
        )

        self.app = FastAPI()
        self.app.include_router(discounts.router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db

        # Seed an instructor (admin), a student submitter, and that student's
        # pending discount request.
        db = self.SessionLocal()
        try:
            self.admin = User(
                id="admin-1",
                email="admin@test.com",
                full_name="Admin",
                hashed_password="x",
                role="instructor",
            )
            self.student = User(
                id="student-1",
                email="student@test.com",
                full_name="Student",
                hashed_password="x",
                role="student",
                discount_tier="none",
            )
            db.add_all([self.admin, self.student])
            req = DiscountRequest(
                id="req-1",
                user_id=self.student.id,
                details="college id 123",
                status="pending",
            )
            db.add(req)
            db.commit()
            self.request_id = req.id
        finally:
            db.close()

    def teardown_method(self):
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)

    def _act_as(self, user):
        """Override get_current_user to return the given seeded user."""
        self.app.dependency_overrides[get_current_user] = lambda: user

    def _reload_request(self):
        db = self.SessionLocal()
        try:
            return db.query(DiscountRequest).filter(
                DiscountRequest.id == self.request_id
            ).first()
        finally:
            db.close()

    def _reload_student(self):
        db = self.SessionLocal()
        try:
            return db.query(User).filter(User.id == self.student.id).first()
        finally:
            db.close()


class TestAdminListShape(_AdminDiscountTestBase):
    """Req 3.1 — admin list returns request shapes with status + user_id."""

    def test_admin_list_returns_request_shapes(self):
        """GET /api/discounts/requests as an instructor returns a list where each
        item carries status and the submitting user id (Req 3.1).

        **Validates: Requirements 3.1**
        """
        self._act_as(self.admin)
        client = TestClient(self.app)

        resp = client.get("/api/discounts/requests")
        assert resp.status_code == 200, resp.text

        body = resp.json()
        assert isinstance(body, list), "admin list must be a JSON array"
        assert len(body) == 1

        item = body[0]
        # Shape contains status + submitting user id (Req 3.1).
        assert item["status"] == "pending"
        assert item["user_id"] == self.student.id
        assert item["id"] == self.request_id


class TestNonAdminApproveRejectForbidden(_AdminDiscountTestBase):
    """Req 3.5 — non-admin approve/reject → 403 with no state change."""

    def test_student_approve_forbidden_no_state_change(self):
        """A student calling approve is rejected 403; request stays pending and
        the student's tier stays none (Req 3.5).

        **Validates: Requirements 3.5**
        """
        self._act_as(self.student)
        client = TestClient(self.app)

        resp = client.post(
            f"/api/discounts/requests/{self.request_id}/approve",
            params={"tier": "student_t1"},
        )
        assert resp.status_code == 403, resp.text

        # No state change: request still pending, no granted tier (Req 3.5).
        req = self._reload_request()
        assert req.status == "pending"
        assert req.granted_tier is None
        # Student's discount tier untouched.
        assert self._reload_student().discount_tier == "none"

    def test_student_reject_forbidden_no_state_change(self):
        """A student calling reject is rejected 403; request stays pending (Req 3.5).

        **Validates: Requirements 3.5**
        """
        self._act_as(self.student)
        client = TestClient(self.app)

        resp = client.post(
            f"/api/discounts/requests/{self.request_id}/reject",
        )
        assert resp.status_code == 403, resp.text

        req = self._reload_request()
        assert req.status == "pending"
        assert req.granted_tier is None
        assert self._reload_student().discount_tier == "none"
