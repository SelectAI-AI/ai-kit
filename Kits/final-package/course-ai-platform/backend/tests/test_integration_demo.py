"""
Integration tests for demo showcase mode.
Tasks 6.1, 6.2, 6.3 — Validates Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 6.1, 6.2, 6.3, 7.2, 7.3, 7.4
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import Base, get_db
from app.models import Progress, CertificateRecord


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def make_engine():
    """Create a fresh in-memory SQLite engine with all tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


def make_session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def make_manifest(slug="test-module", n=2):
    """Return a minimal 2-notebook manifest suitable for mocking cs."""
    notebooks = [
        {
            "filename": f"nb_{i}.ipynb",
            "question_type": "quiz",
            "answer": "correct",
            "title": f"NB {i}",
            "prompt": "What is the answer?",
            "description": None,
        }
        for i in range(n)
    ]
    return {
        "slug": slug,
        "notebooks": notebooks,
        "title": "Test Module",
        "intro_path": None,
        "intro_file": None,
        "module_dir": None,
    }


def make_cs_mock(slug="test-module", n=2):
    """Build a MagicMock that stands in for content_scanner in all routers."""
    manifest = make_manifest(slug=slug, n=n)
    mock = MagicMock()
    mock.list_module_slugs.return_value = [slug]
    mock.get_module_manifest.return_value = manifest
    mock.read_intro_markdown.return_value = "## Intro"
    mock.notebook_path.return_value = None
    return mock


def register_and_login(client, email="demo@test.com", password="testpass123"):
    """Register a user and return a Bearer token. Idempotent — ignores 400 on duplicate."""
    client.post(
        "/api/auth/register",
        json={"email": email, "full_name": "Demo User", "password": password},
    )
    resp = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


MODULE_SLUG = "test-module"


# ---------------------------------------------------------------------------
# Task 6.1 — Full demo flow: register → modules → complete → certificate
# Validates: 2.1, 2.2, 3.1, 4.1, 4.2, 6.1, 6.2, 6.3
# ---------------------------------------------------------------------------

class TestFullDemoFlow:
    """
    Task 6.1 — Full demo flow integration test.
    Validates Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 6.1, 6.2, 6.3
    """

    def setup_method(self):
        self.engine = make_engine()
        SessionLocal = make_session_factory(self.engine)

        def override_get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db

    def teardown_method(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)

    def test_full_demo_flow(self):
        """
        Validates Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 6.1, 6.2, 6.3

        Full demo showcase flow:
          - Register + login
          - GET /api/modules → all percent_complete=100.0
          - GET /api/modules/{slug} → all notebooks unlocked=True, completed=True
          - POST .../notebook/{filename}/complete with empty payload → success=True
          - POST /api/certificates/request → status="issued"
        """
        mock_cs = make_cs_mock(slug=MODULE_SLUG, n=2)
        mock_pdf = MagicMock(return_value=None)

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.certificates.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.routers.certificates.settings") as cert_settings,
            patch("app.progress_utils.settings") as pu_settings,
            patch("app.routers.certificates.generate_certificate_pdf", mock_pdf),
        ):
            mod_settings.demo_mode = True
            cert_settings.demo_mode = True
            cert_settings.require_instructor_approval = False
            pu_settings.demo_mode = True

            client = TestClient(app)

            # Step 1: register + login
            token = register_and_login(client, email="fullflow@test.com")
            headers = {"Authorization": f"Bearer {token}"}

            # Step 2: GET /api/modules — all summaries should show 100%
            resp = client.get("/api/modules", headers=headers)
            assert resp.status_code == 200, f"GET /api/modules failed: {resp.text}"
            modules = resp.json()
            assert len(modules) >= 1
            for mod in modules:
                assert mod["percent_complete"] == 100.0, (
                    f"Expected 100.0 percent_complete in demo mode, got {mod['percent_complete']}"
                )

            # Step 3: GET /api/modules/{slug} — all notebooks unlocked and completed
            resp = client.get(f"/api/modules/{MODULE_SLUG}", headers=headers)
            assert resp.status_code == 200, f"GET /api/modules/{MODULE_SLUG} failed: {resp.text}"
            detail = resp.json()
            assert detail["percent_complete"] == 100.0
            for nb in detail["notebooks"]:
                assert nb["unlocked"] is True, f"Notebook {nb['filename']} should be unlocked in demo mode"
                assert nb["completed"] is True, f"Notebook {nb['filename']} should be completed in demo mode"

            # Step 4: POST .../complete with empty payload → success=True
            first_nb = detail["notebooks"][0]["filename"]
            resp = client.post(
                f"/api/modules/{MODULE_SLUG}/notebook/{first_nb}/complete",
                json={"response": "", "self_attest": False},
                headers=headers,
            )
            assert resp.status_code == 200, f"complete endpoint failed: {resp.text}"
            result = resp.json()
            assert result["success"] is True, f"Expected success=True in demo mode, got {result}"

            # Step 5: POST /api/certificates/request → status="issued"
            resp = client.post(
                "/api/certificates/request",
                json={"confirm_identity": True, "legal_name": "Demo User"},
                headers=headers,
            )
            assert resp.status_code == 200, f"Certificate request failed: {resp.text}"
            cert = resp.json()
            assert cert["status"] == "issued", (
                f"Expected certificate status='issued' in demo mode, got '{cert['status']}'"
            )


# ---------------------------------------------------------------------------
# Task 6.2 — Mode-toggle cleanup: demo rows reset when demo_mode turns off
# Validates: 7.2, 7.4
# ---------------------------------------------------------------------------

class TestModeToggleCleanup:
    """
    Task 6.2 — Mode-toggle cleanup integration test.
    Validates Requirements: 7.2, 7.4
    """

    def setup_method(self):
        self.engine = make_engine()
        SessionLocal = make_session_factory(self.engine)
        self._SessionLocal = SessionLocal

        def override_get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db

    def teardown_method(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)

    def _get_user_id(self, email="toggle@test.com"):
        """Look up the user id from the test DB."""
        from app.models import User
        db = self._SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            return user.id if user else None
        finally:
            db.close()

    def _get_progress_rows(self, user_id):
        db = self._SessionLocal()
        try:
            return db.query(Progress).filter(Progress.user_id == user_id).all()
        finally:
            db.close()

    def test_mode_toggle_cleanup(self):
        """
        Validates Requirements: 7.2, 7.4

        Phase 1 (demo_mode=True):
          - Access module detail → demo_initialised rows are created
          - Assert demo_initialised=True for all progress rows

        Phase 2 (demo_mode=False):
          - Access same module detail with same user+DB
          - Assert only first notebook has unlocked=True
          - Assert all demo_initialised=False
        """
        mock_cs = make_cs_mock(slug=MODULE_SLUG, n=2)
        email = "toggle@test.com"

        # ---- Phase 1: demo_mode = True ----
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = True
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email=email)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get(f"/api/modules/{MODULE_SLUG}", headers=headers)
            assert resp.status_code == 200, f"Demo GET detail failed: {resp.text}"

        # Verify demo_initialised=True rows were written to DB
        user_id = self._get_user_id(email)
        assert user_id is not None, "User was not created in test DB"

        rows_after_demo = self._get_progress_rows(user_id)
        assert len(rows_after_demo) == 2, (
            f"Expected 2 progress rows, got {len(rows_after_demo)}"
        )
        for row in rows_after_demo:
            assert row.demo_initialised is True, (
                f"Expected demo_initialised=True for {row.notebook_file} after demo access"
            )

        # ---- Phase 2: demo_mode = False (same user, same DB) ----
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = False
            pu_settings.demo_mode = False

            client = TestClient(app)
            resp = client.get(f"/api/modules/{MODULE_SLUG}", headers=headers)
            assert resp.status_code == 200, f"Normal GET detail failed: {resp.text}"

        # Verify cleanup: all demo_initialised=False, only first notebook unlocked
        rows_after_reset = self._get_progress_rows(user_id)
        filenames = [make_manifest(slug=MODULE_SLUG, n=2)["notebooks"][i]["filename"] for i in range(2)]

        # Build a map for easy lookup
        row_map = {r.notebook_file: r for r in rows_after_reset}

        for row in rows_after_reset:
            assert row.demo_initialised is False, (
                f"Expected demo_initialised=False after toggle, got True for {row.notebook_file}"
            )

        # Only first notebook should be unlocked
        assert row_map[filenames[0]].unlocked is True, (
            f"First notebook {filenames[0]} should be unlocked after demo→normal toggle"
        )
        assert row_map[filenames[1]].unlocked is False, (
            f"Second notebook {filenames[1]} should be locked after demo→normal toggle"
        )

        # All completed flags reset to False
        for row in rows_after_reset:
            assert row.completed is False, (
                f"Expected completed=False after demo→normal toggle for {row.notebook_file}"
            )


# ---------------------------------------------------------------------------
# Task 6.3 — Certificates remain valid after demo mode toggle
# Validates: 7.3
# ---------------------------------------------------------------------------

class TestCertificateValidAfterToggle:
    """
    Task 6.3 — Certificates remain valid after demo mode toggle.
    Validates Requirements: 7.3
    """

    def setup_method(self):
        self.engine = make_engine()
        SessionLocal = make_session_factory(self.engine)

        def override_get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db

    def teardown_method(self):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=self.engine)

    def test_certificate_valid_after_demo_toggle(self):
        """
        Validates Requirements: 7.3

        Steps:
          1. demo_mode=True → issue certificate → capture cert_id
          2. demo_mode=False → GET /api/certificates/verify/{cert_id}
          3. Assert valid=True and status="issued"
        """
        mock_cs = make_cs_mock(slug=MODULE_SLUG, n=2)
        mock_pdf = MagicMock(return_value=None)
        email = "certvalid@test.com"

        # ---- Phase 1: issue certificate in demo mode ----
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.certificates.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.routers.certificates.settings") as cert_settings,
            patch("app.progress_utils.settings") as pu_settings,
            patch("app.routers.certificates.generate_certificate_pdf", mock_pdf),
        ):
            mod_settings.demo_mode = True
            cert_settings.demo_mode = True
            cert_settings.require_instructor_approval = False
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email=email)
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.post(
                "/api/certificates/request",
                json={"confirm_identity": True, "legal_name": "Demo User"},
                headers=headers,
            )
            assert resp.status_code == 200, f"Certificate request failed: {resp.text}"
            cert = resp.json()
            assert cert["status"] == "issued", (
                f"Expected status='issued' in demo mode, got '{cert['status']}'"
            )
            cert_id = cert["id"]

        # ---- Phase 2: verify certificate with demo_mode=False ----
        # The verify endpoint is public (no auth) and must not care about demo_mode.
        # We patch settings to False to confirm the record persists independently.
        with (
            patch("app.routers.certificates.settings") as cert_settings,
        ):
            cert_settings.demo_mode = False
            cert_settings.require_instructor_approval = False

            client = TestClient(app)
            resp = client.get(f"/api/certificates/verify/{cert_id}")
            assert resp.status_code == 200, f"Verify endpoint failed: {resp.text}"
            data = resp.json()

        assert data["valid"] is True, (
            f"Expected valid=True after demo→normal toggle, got {data}"
        )
        assert data["status"] == "issued", (
            f"Expected status='issued' after demo→normal toggle, got '{data['status']}'"
        )
