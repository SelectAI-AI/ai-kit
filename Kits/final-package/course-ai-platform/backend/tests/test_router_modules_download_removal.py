"""
Integration tests for backend download-route removal and view retention.

Task 9.2 — Validates Requirements: 8.2, 8.3, 8.4, 9.2, 9.3

Covers:
  - GET /api/modules/{slug}/notebook/{filename}/download -> 404, no .ipynb body (8.2)
  - non-GET methods on the download path -> no .ipynb content (8.3)
  - GET /api/modules/{slug}/download-package -> 404 (9.2)
  - non-GET on the package path -> 404 (9.3)
  - GET /api/modules/{slug}/notebook/{filename}/view for an unlocked
    notebook -> 200 + HTML (8.4)
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import Base, get_db


# ---------------------------------------------------------------------------
# Shared helpers (mirror tests/test_integration_demo.py conventions)
# ---------------------------------------------------------------------------

MODULE_SLUG = "test-module"
NOTEBOOK_FILE = "nb_0.ipynb"


def make_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


def make_session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def make_manifest(slug=MODULE_SLUG, n=2):
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


def make_cs_mock(slug=MODULE_SLUG, n=2):
    manifest = make_manifest(slug=slug, n=n)
    mock = MagicMock()
    mock.list_module_slugs.return_value = [slug]
    mock.get_module_manifest.return_value = manifest
    mock.read_intro_markdown.return_value = "## Intro"
    mock.notebook_path.return_value = None
    return mock


def register_and_login(client, email="download@test.com", password="testpass123"):
    client.post(
        "/api/auth/register",
        json={"email": email, "full_name": "Download User", "password": password},
    )
    resp = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


# A couple of slug/filename combinations exercised for the download path.
DOWNLOAD_CASES = [
    (MODULE_SLUG, NOTEBOOK_FILE),
    ("another-module", "nb_1.ipynb"),
]


def _is_ipynb_body(response) -> bool:
    """True if the response looks like it carries a raw .ipynb file body."""
    content_type = response.headers.get("content-type", "").lower()
    disposition = response.headers.get("content-disposition", "").lower()
    if "application/x-ipynb+json" in content_type:
        return True
    if ".ipynb" in disposition:
        return True
    # nbformat JSON always contains an "nbformat" key at the top level.
    text = response.text or ""
    return '"nbformat"' in text and '"cells"' in text


class _BaseRoutingTest:
    """Sets up an in-memory DB override; subclasses provide test methods."""

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


# ---------------------------------------------------------------------------
# Requirement 8.2 — GET notebook download path returns 404, no .ipynb body
# ---------------------------------------------------------------------------

class TestNotebookDownloadRemoved(_BaseRoutingTest):
    """Requirement 8.2, 8.3"""

    @pytest.mark.parametrize("slug,filename", DOWNLOAD_CASES)
    def test_get_notebook_download_returns_404_no_ipynb(self, slug, filename):
        """GET .../notebook/{filename}/download -> 404 and no .ipynb body (8.2)."""
        mock_cs = make_cs_mock()
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = True
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email="get-nb-dl@test.com")
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get(
                f"/api/modules/{slug}/notebook/{filename}/download",
                headers=headers,
            )

        assert resp.status_code == 404, (
            f"Expected 404 for removed download route, got {resp.status_code}: {resp.text}"
        )
        assert not _is_ipynb_body(resp), (
            f"Removed download route must not return .ipynb content, got: {resp.text[:200]}"
        )

    @pytest.mark.parametrize("method", ["POST", "PUT", "DELETE", "PATCH"])
    @pytest.mark.parametrize("slug,filename", DOWNLOAD_CASES)
    def test_non_get_notebook_download_returns_no_ipynb(self, method, slug, filename):
        """Non-GET on the download path -> no .ipynb content (8.3)."""
        mock_cs = make_cs_mock()
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = True
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email="nonget-nb-dl@test.com")
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.request(
                method,
                f"/api/modules/{slug}/notebook/{filename}/download",
                headers=headers,
            )

        # No route is registered, so any method must return an error status
        # (typically 404 Not Found or 405 Method Not Allowed) and never a body
        # containing raw notebook content.
        assert resp.status_code >= 400, (
            f"{method} on removed download route must not succeed, got {resp.status_code}"
        )
        assert not _is_ipynb_body(resp), (
            f"{method} on removed download route must not return .ipynb content"
        )


# ---------------------------------------------------------------------------
# Requirement 9.2 / 9.3 — package download path removed for all methods
# ---------------------------------------------------------------------------

class TestPackageDownloadRemoved(_BaseRoutingTest):
    """Requirement 9.2, 9.3"""

    @pytest.mark.parametrize("slug", [MODULE_SLUG, "another-module"])
    def test_get_package_download_returns_404(self, slug):
        """GET .../download-package -> 404 (9.2)."""
        mock_cs = make_cs_mock()
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = True
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email="get-pkg-dl@test.com")
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get(
                f"/api/modules/{slug}/download-package",
                headers=headers,
            )

        assert resp.status_code == 404, (
            f"Expected 404 for removed package route, got {resp.status_code}: {resp.text}"
        )

    @pytest.mark.parametrize("method", ["POST", "PUT", "DELETE", "PATCH"])
    @pytest.mark.parametrize("slug", [MODULE_SLUG, "another-module"])
    def test_non_get_package_download_returns_404(self, method, slug):
        """Non-GET on the package path -> 404 (9.3)."""
        mock_cs = make_cs_mock()
        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = True
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email="nonget-pkg-dl@test.com")
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.request(
                method,
                f"/api/modules/{slug}/download-package",
                headers=headers,
            )

        assert resp.status_code == 404, (
            f"Expected 404 for {method} on removed package route, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# Requirement 8.4 — view endpoint retained: unlocked notebook -> 200 + HTML
# ---------------------------------------------------------------------------

class TestViewEndpointRetained(_BaseRoutingTest):
    """Requirement 8.4"""

    def test_view_unlocked_notebook_returns_200_html(self):
        """GET .../notebook/{filename}/view for an unlocked notebook -> 200 + HTML (8.4)."""
        mock_cs = make_cs_mock()
        # Simulate a resolvable notebook file and rendered HTML output.
        mock_cs.notebook_path.return_value = Path("nb_0.ipynb")
        rendered_html = "<html><body><h1>Notebook HTML</h1></body></html>"
        mock_cs.render_notebook_html.return_value = rendered_html

        with (
            patch("app.routers.modules.cs", mock_cs),
            # demo_mode=True makes _assert_unlocked treat the notebook as unlocked,
            # mirroring how existing tests exercise the view path.
            patch("app.routers.modules.settings") as mod_settings,
            patch("app.progress_utils.settings") as pu_settings,
        ):
            mod_settings.demo_mode = True
            pu_settings.demo_mode = True

            client = TestClient(app)
            token = register_and_login(client, email="view-nb@test.com")
            headers = {"Authorization": f"Bearer {token}"}

            resp = client.get(
                f"/api/modules/{MODULE_SLUG}/notebook/{NOTEBOOK_FILE}/view",
                headers=headers,
            )

        assert resp.status_code == 200, (
            f"View endpoint must return 200 for an unlocked notebook, got "
            f"{resp.status_code}: {resp.text}"
        )
        assert "text/html" in resp.headers.get("content-type", "").lower(), (
            f"View endpoint must return HTML, got content-type "
            f"{resp.headers.get('content-type')}"
        )
        assert rendered_html in resp.text, "View endpoint must return the rendered notebook HTML"
