"""
Property test for normal-mode quiz — Property 3.
Validates Requirement 3.5
"""
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from app.database import Base
from app.models import User, Progress
from app.schemas import UnlockSubmission


@given(expected=st.text(min_size=1), given_answer=st.text())
@hyp_settings(max_examples=100, deadline=None)
def test_normal_quiz_exact_match(expected, given_answer):
    """
    Property 3: In normal mode, quiz completion succeeds iff
    given_answer.strip().lower() == expected.strip().lower() (and expected is non-empty after strip).

    **Validates: Requirements 3.5**
    """
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        user = User(id="u1", email="u@test.com", full_name="Test", hashed_password="x")
        db.add(user)
        row = Progress(user_id="u1", module_slug="mod", notebook_file="nb_0.ipynb",
                       unlocked=True, completed=False)
        db.add(row)
        db.commit()

        notebooks = [{"filename": "nb_0.ipynb", "question_type": "quiz",
                      "answer": expected, "title": "NB", "prompt": "Q?"}]
        manifest = {"notebooks": notebooks, "title": "Mod",
                    "intro_file": None, "module_dir": None}

        mock_cs = MagicMock()
        mock_cs.get_module_manifest.return_value = manifest

        mock_settings = MagicMock()
        mock_settings.demo_mode = False

        payload = UnlockSubmission(response=given_answer, self_attest=False)

        from app.routers.modules import complete_notebook
        with patch("app.routers.modules.cs", mock_cs), \
             patch("app.routers.modules.settings", mock_settings), \
             patch("app.progress_utils.settings", mock_settings):
            result = complete_notebook("mod", "nb_0.ipynb", payload, db=db, user=user)

        expected_success = (
            bool(expected.strip()) and
            given_answer.strip().lower() == expected.strip().lower()
        )
        assert result.success == expected_success
    finally:
        db.close()
