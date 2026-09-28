"""
Unit tests for progress utility functions.
Validates Requirements 7.2, 7.4
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from app.database import Base
from app.models import Progress
from app.progress_utils import (
    ensure_demo_progress_rows,
    reset_progress_to_normal,
    ensure_progress_rows,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite session; tables created fresh for each test."""
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------

NOTEBOOKS_3 = [{"filename": f"nb_{i}.ipynb"} for i in range(3)]
USER_ID = "test-user-1"
SLUG = "test-module"


# ---------------------------------------------------------------------------
# TestEnsureDemoProgressRows
# ---------------------------------------------------------------------------


class TestEnsureDemoProgressRows:
    """Tests for ensure_demo_progress_rows (Requirement 7.2)."""

    def test_inserts_all_rows_on_empty_db(self, db_session):
        """All notebooks get Progress rows with unlocked, completed, demo_initialised=True."""
        ensure_demo_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        rows = db_session.query(Progress).all()
        assert len(rows) == 3
        for row in rows:
            assert row.unlocked is True
            assert row.completed is True
            assert row.demo_initialised is True

    def test_idempotent_called_twice(self, db_session):
        """Calling twice produces no duplicate rows and all flags remain True."""
        ensure_demo_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)
        ensure_demo_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        rows = db_session.query(Progress).all()
        assert len(rows) == 3  # no duplicates
        for row in rows:
            assert row.unlocked is True
            assert row.completed is True
            assert row.demo_initialised is True


# ---------------------------------------------------------------------------
# TestResetProgressToNormal
# ---------------------------------------------------------------------------


class TestResetProgressToNormal:
    """Tests for reset_progress_to_normal (Requirement 7.4)."""

    def test_resets_demo_initialised_rows(self, db_session):
        """
        After a demo reset:
          - first notebook: unlocked=True, completed=False, demo_initialised=False
          - remaining notebooks: unlocked=False, completed=False, demo_initialised=False
        """
        ensure_demo_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)
        reset_progress_to_normal(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        rows = (
            db_session.query(Progress)
            .filter_by(user_id=USER_ID, module_slug=SLUG)
            .order_by(Progress.id)
            .all()
        )
        # Map by filename for stable ordering
        by_file = {r.notebook_file: r for r in rows}

        first_row = by_file["nb_0.ipynb"]
        assert first_row.unlocked is True
        assert first_row.completed is False
        assert first_row.demo_initialised is False

        for name in ("nb_1.ipynb", "nb_2.ipynb"):
            row = by_file[name]
            assert row.unlocked is False
            assert row.completed is False
            assert row.demo_initialised is False

    def test_leaves_non_demo_rows_untouched(self, db_session):
        """
        A row with demo_initialised=False (genuine completion) must not be
        modified by reset_progress_to_normal.
        """
        genuine_row = Progress(
            user_id=USER_ID,
            module_slug=SLUG,
            notebook_file="nb_0.ipynb",
            unlocked=True,
            completed=True,
            demo_initialised=False,
        )
        db_session.add(genuine_row)
        db_session.commit()

        reset_progress_to_normal(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        row = (
            db_session.query(Progress)
            .filter_by(user_id=USER_ID, module_slug=SLUG, notebook_file="nb_0.ipynb")
            .first()
        )
        # Should be completely untouched
        assert row.completed is True
        assert row.unlocked is True
        assert row.demo_initialised is False


# ---------------------------------------------------------------------------
# TestEnsureProgressRowsModeToggle
# ---------------------------------------------------------------------------


class TestEnsureProgressRowsModeToggle:
    """Tests for the mode-toggle guard in ensure_progress_rows (Requirements 7.2, 7.4)."""

    def test_delegates_to_reset_when_demo_rows_exist_and_mode_off(self, db_session):
        """
        When demo_mode=False and existing rows have demo_initialised=True,
        ensure_progress_rows delegates to reset_progress_to_normal:
          - first notebook unlocked, not completed
          - remaining notebooks locked
        """
        ensure_demo_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        with patch("app.progress_utils.settings") as mock_settings:
            mock_settings.demo_mode = False
            result = ensure_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        assert result["nb_0.ipynb"].unlocked is True
        assert result["nb_0.ipynb"].completed is False
        assert result["nb_1.ipynb"].unlocked is False
        assert result["nb_2.ipynb"].unlocked is False

    def test_normal_insertion_path_when_no_demo_rows(self, db_session):
        """
        When demo_mode=False and no rows exist at all, ensure_progress_rows
        follows the normal path: first notebook unlocked, rest locked.
        """
        with patch("app.progress_utils.settings") as mock_settings:
            mock_settings.demo_mode = False
            result = ensure_progress_rows(db_session, USER_ID, SLUG, NOTEBOOKS_3)

        assert result["nb_0.ipynb"].unlocked is True
        assert result["nb_1.ipynb"].unlocked is False
        assert result["nb_2.ipynb"].unlocked is False
        # No demo_initialised flags set
        assert result["nb_0.ipynb"].demo_initialised is False
