"""
Unit tests for demo-mode branches in the modules and certificates routers.
Validates Requirements: 2.3, 2.4, 3.1, 3.5, 4.1, 4.2, 4.6, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3
"""
import logging
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from app.database import Base
from app.models import User, Progress, CertificateRecord
from app.schemas import UnlockSubmission, CertificateRequestIn


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def user(db_session):
    u = User(id="u1", email="u@test.com", full_name="Test User", hashed_password="x")
    db_session.add(u)
    db_session.commit()
    return u


def make_manifest(n=3):
    notebooks = [
        {
            "filename": f"nb_{i}.ipynb",
            "question_type": "quiz",
            "answer": "correct",
            "title": f"NB {i}",
            "prompt": "Q?",
            "description": None,
        }
        for i in range(n)
    ]
    return {
        "notebooks": notebooks,
        "title": "Test Module",
        "intro_file": None,
        "module_dir": None,
    }


# ---------------------------------------------------------------------------
# Helper: build a fake content_scanner mock
# ---------------------------------------------------------------------------


def _mock_cs(manifest=None, slugs=None):
    """Return a MagicMock that stands in for `app.routers.modules.cs`."""
    mock = MagicMock()
    mock.list_module_slugs.return_value = slugs if slugs is not None else ["test-slug"]
    mock.get_module_manifest.return_value = manifest if manifest is not None else make_manifest()
    mock.read_intro_markdown.return_value = "## Intro"
    mock.notebook_path.return_value = None
    return mock


# ---------------------------------------------------------------------------
# 1. list_modules — demo mode returns percent_complete=100 for all modules
# ---------------------------------------------------------------------------


class TestListModulesDemoMode:
    """Requirement 2.3, 2.4"""

    def test_list_modules_demo_mode_returns_100_percent(self, db_session, user):
        """GET /api/modules: every module summary shows percent_complete=100.0 in demo mode."""
        manifest = make_manifest(n=3)
        mock_cs = _mock_cs(manifest=manifest, slugs=["test-slug"])

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mock_settings,
        ):
            mock_settings.demo_mode = True

            from app.routers.modules import list_modules

            result = list_modules(db=db_session, user=user)

        assert len(result) == 1
        summary = result[0]
        assert summary.percent_complete == 100.0
        assert summary.completed_notebooks == summary.total_notebooks
        assert summary.total_notebooks == 3


# ---------------------------------------------------------------------------
# 2. module_detail — demo mode returns all notebooks unlocked & completed
# ---------------------------------------------------------------------------


class TestModuleDetailDemoMode:
    """Requirement 3.1, 3.5"""

    def test_module_detail_demo_mode_all_unlocked(self, db_session, user):
        """GET /api/modules/{slug}: all notebooks have unlocked=True, completed=True in demo mode."""
        manifest = make_manifest(n=3)
        mock_cs = _mock_cs(manifest=manifest)

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mock_settings,
        ):
            mock_settings.demo_mode = True

            from app.routers.modules import module_detail

            result = module_detail(slug="test-slug", db=db_session, user=user)

        assert result.percent_complete == 100.0
        for nb in result.notebooks:
            assert nb.unlocked is True
            assert nb.completed is True


# ---------------------------------------------------------------------------
# 3. _assert_unlocked — no raise when demo_mode=True, even with a locked row
# ---------------------------------------------------------------------------


class TestAssertUnlockedDemoMode:
    """Requirement 4.1"""

    def test_assert_unlocked_demo_mode_does_not_raise(self, db_session, user):
        """_assert_unlocked must silently return (not raise) when demo_mode=True."""
        # Insert a explicitly locked Progress row
        locked_row = Progress(
            user_id=user.id,
            module_slug="test-slug",
            notebook_file="nb_0.ipynb",
            unlocked=False,
            completed=False,
        )
        db_session.add(locked_row)
        db_session.commit()

        manifest = make_manifest(n=1)
        mock_cs = _mock_cs(manifest=manifest)

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mock_settings,
        ):
            mock_settings.demo_mode = True

            from app.routers.modules import _assert_unlocked

            # Should not raise HTTPException
            _assert_unlocked(db_session, user, "test-slug", "nb_0.ipynb")


# ---------------------------------------------------------------------------
# 4. complete_notebook — empty payload in demo mode returns success=True
# ---------------------------------------------------------------------------


class TestCompleteNotebookDemoMode:
    """Requirement 4.2, 4.6"""

    def _insert_unlocked_row(self, db_session, user, slug="test-slug", filename="nb_0.ipynb"):
        row = Progress(
            user_id=user.id,
            module_slug=slug,
            notebook_file=filename,
            unlocked=True,
            completed=False,
        )
        db_session.add(row)
        db_session.commit()
        return row

    def test_complete_notebook_empty_payload_demo_mode(self, db_session, user):
        """An empty submission in demo mode must return success=True."""
        self._insert_unlocked_row(db_session, user)
        manifest = make_manifest(n=3)
        # Also insert rows for the other notebooks (needed by ensure_progress_rows)
        for i in range(1, 3):
            db_session.add(Progress(
                user_id=user.id,
                module_slug="test-slug",
                notebook_file=f"nb_{i}.ipynb",
                unlocked=False,
                completed=False,
            ))
        db_session.commit()

        mock_cs = _mock_cs(manifest=manifest)
        payload = UnlockSubmission(response="", self_attest=False)

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mock_settings,
        ):
            mock_settings.demo_mode = True

            from app.routers.modules import complete_notebook

            result = complete_notebook(
                slug="test-slug",
                filename="nb_0.ipynb",
                payload=payload,
                db=db_session,
                user=user,
            )

        assert result.success is True

    # ---------------------------------------------------------------------------
    # 5. complete_notebook — wrong answer in normal mode returns success=False
    # ---------------------------------------------------------------------------

    def test_complete_notebook_wrong_answer_normal_mode(self, db_session, user):
        """A wrong quiz answer in normal mode must return success=False."""
        self._insert_unlocked_row(db_session, user)
        for i in range(1, 3):
            db_session.add(Progress(
                user_id=user.id,
                module_slug="test-slug",
                notebook_file=f"nb_{i}.ipynb",
                unlocked=False,
                completed=False,
            ))
        db_session.commit()

        manifest = make_manifest(n=3)  # answer="correct" for all notebooks
        mock_cs = _mock_cs(manifest=manifest)
        payload = UnlockSubmission(response="wrong answer", self_attest=False)

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mock_settings,
        ):
            mock_settings.demo_mode = False

            from app.routers.modules import complete_notebook

            result = complete_notebook(
                slug="test-slug",
                filename="nb_0.ipynb",
                payload=payload,
                db=db_session,
                user=user,
            )

        assert result.success is False


# ---------------------------------------------------------------------------
# 6. request_certificate — demo mode issues immediately
# ---------------------------------------------------------------------------


class TestRequestCertificateDemoMode:
    """Requirement 6.1, 6.2, 6.3"""

    def test_request_certificate_demo_mode_issues_immediately(self, db_session, user):
        """In demo mode, request_certificate must return status='issued' straight away."""
        payload = CertificateRequestIn(confirm_identity=True, legal_name="Test User")
        mock_pdf = MagicMock(return_value=None)

        with (
            patch("app.routers.certificates.settings") as mock_settings,
            patch("app.routers.certificates.generate_certificate_pdf", mock_pdf),
        ):
            mock_settings.demo_mode = True
            mock_settings.require_instructor_approval = False

            from app.routers.certificates import request_certificate

            result = request_certificate(payload=payload, db=db_session, user=user)

        assert result.status == "issued"
        mock_pdf.assert_called_once()

    # ---------------------------------------------------------------------------
    # 7. request_certificate — PDF failure in demo mode → HTTP 500, no DB record
    # ---------------------------------------------------------------------------

    def test_request_certificate_pdf_failure_demo_mode_no_persist(self, db_session, user):
        """When PDF generation fails in demo mode, return HTTP 500 and no CertificateRecord persists."""
        from fastapi import HTTPException

        payload = CertificateRequestIn(confirm_identity=True, legal_name="Test User")
        mock_pdf = MagicMock(side_effect=Exception("PDF boom"))

        with (
            patch("app.routers.certificates.settings") as mock_settings,
            patch("app.routers.certificates.generate_certificate_pdf", mock_pdf),
        ):
            mock_settings.demo_mode = True
            mock_settings.require_instructor_approval = False

            from app.routers.certificates import request_certificate

            with pytest.raises(HTTPException) as exc_info:
                request_certificate(payload=payload, db=db_session, user=user)

        assert exc_info.value.status_code == 500
        # No certificate record should remain in the DB
        remaining = db_session.query(CertificateRecord).filter_by(user_id=user.id).all()
        assert len(remaining) == 0


# ---------------------------------------------------------------------------
# 8. Logging — complete_notebook logs "DEMO_MODE" in demo mode
# ---------------------------------------------------------------------------


class TestDemoModeLogging:
    """Requirement 8.1, 8.2, 8.3"""

    def test_complete_notebook_logs_demo_mode(self, db_session, user, caplog):
        """complete_notebook must emit a log record containing 'DEMO_MODE' in demo mode."""
        # Set up Progress rows
        db_session.add(Progress(
            user_id=user.id,
            module_slug="test-slug",
            notebook_file="nb_0.ipynb",
            unlocked=True,
            completed=False,
        ))
        for i in range(1, 3):
            db_session.add(Progress(
                user_id=user.id,
                module_slug="test-slug",
                notebook_file=f"nb_{i}.ipynb",
                unlocked=False,
                completed=False,
            ))
        db_session.commit()

        manifest = make_manifest(n=3)
        mock_cs = _mock_cs(manifest=manifest)
        payload = UnlockSubmission(response="", self_attest=False)

        with (
            patch("app.routers.modules.cs", mock_cs),
            patch("app.routers.modules.settings") as mock_settings,
            caplog.at_level(logging.INFO, logger="app.routers.modules"),
        ):
            mock_settings.demo_mode = True

            from app.routers.modules import complete_notebook

            complete_notebook(
                slug="test-slug",
                filename="nb_0.ipynb",
                payload=payload,
                db=db_session,
                user=user,
            )

        assert "DEMO_MODE" in caplog.text

    def test_request_certificate_logs_demo_mode(self, db_session, user, caplog):
        """request_certificate must emit a log record containing 'DEMO_MODE' in demo mode."""
        payload = CertificateRequestIn(confirm_identity=True, legal_name="Test User")
        mock_pdf = MagicMock(return_value=None)

        with (
            patch("app.routers.certificates.settings") as mock_settings,
            patch("app.routers.certificates.generate_certificate_pdf", mock_pdf),
            caplog.at_level(logging.INFO, logger="app.routers.certificates"),
        ):
            mock_settings.demo_mode = True
            mock_settings.require_instructor_approval = False

            from app.routers.certificates import request_certificate

            request_certificate(payload=payload, db=db_session, user=user)

        assert "DEMO_MODE" in caplog.text
