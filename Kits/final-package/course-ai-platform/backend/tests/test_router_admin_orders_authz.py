"""Example test for bulk-order authorization — Task 12.4.

Verifies that a non-admin (student) user attempting to create an admin bulk order
receives a ``403`` and that no ``Order`` row is persisted (Req 10.6). Both bulk
endpoints (``POST /api/admin/orders/college`` and ``/corporate``) are guarded by
``Depends(require_instructor)``, which raises ``403`` when ``user.role`` is not
``"instructor"``.

Uses FastAPI ``TestClient`` against an app that mounts the ``admin_orders``
router, with ``dependency_overrides`` supplying an in-memory SQLite session
(``get_db``) and a student user (``get_current_user``). The router is mounted on a
dedicated test app so the authorization guard is exercised independently of the
global router-registration wiring (task 13.1).

**Validates: Requirements 10.6**
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import Order, User
from app.routers import admin_orders


def make_app():
    """Build a minimal FastAPI app that mounts only the admin-orders router."""
    app = FastAPI()
    app.include_router(admin_orders.router)
    return app


def make_engine():
    """Create a fresh in-memory SQLite engine with all tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


class TestBulkOrderAuthorization:
    """Task 12.4 — Non-admin bulk order creation → 403 with no order created.

    **Validates: Requirements 10.6**
    """

    def setup_method(self):
        self.engine = make_engine()
        SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        self._SessionLocal = SessionLocal
        self.app = make_app()

        def override_get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        # A plain student user — role != "instructor" must be rejected by
        # require_instructor (Req 10.6).
        student = User(
            id="student1",
            email="student@test.com",
            full_name="Student",
            hashed_password="x",
            role="student",
        )
        seed_db = SessionLocal()
        try:
            seed_db.add(student)
            seed_db.commit()
        finally:
            seed_db.close()

        def override_get_current_user():
            db = SessionLocal()
            try:
                return db.query(User).filter(User.id == "student1").first()
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db
        self.app.dependency_overrides[get_current_user] = override_get_current_user

    def teardown_method(self):
        self.app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)

    def _order_count(self):
        db = self._SessionLocal()
        try:
            return db.query(Order).count()
        finally:
            db.close()

    def test_student_college_bulk_order_forbidden(self):
        """Non-admin POST /api/admin/orders/college → 403, no Order persisted.

        **Validates: Requirements 10.6**
        """
        client = TestClient(self.app)
        resp = client.post(
            "/api/admin/orders/college",
            json={"user_ids": ["u1", "u2"]},
        )
        assert resp.status_code == 403, f"expected 403, got {resp.status_code}: {resp.text}"
        assert self._order_count() == 0, "no order should be created for a non-admin"

    def test_student_corporate_bulk_order_forbidden(self):
        """Non-admin POST /api/admin/orders/corporate → 403, no Order persisted.

        **Validates: Requirements 10.6**
        """
        client = TestClient(self.app)
        resp = client.post(
            "/api/admin/orders/corporate",
            json={"user_ids": ["u1", "u2"], "seats": 2},
        )
        assert resp.status_code == 403, f"expected 403, got {resp.status_code}: {resp.text}"
        assert self._order_count() == 0, "no order should be created for a non-admin"
