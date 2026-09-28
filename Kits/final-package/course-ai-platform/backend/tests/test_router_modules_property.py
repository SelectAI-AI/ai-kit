"""
Property test for complete_notebook — Property 1.
Validates Requirement 3.1
"""
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from app.database import Base
from app.models import User, Progress
from app.schemas import UnlockSubmission


@given(response=st.one_of(st.none(), st.text()), self_attest=st.booleans())
@hyp_settings(max_examples=50, deadline=None)
def test_demo_completion_always_succeeds(response, self_attest):
    """
    Property 1: In demo mode, POST .../complete with any payload returns success=True.

    **Validates: Requirements 3.1**
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
                      "answer": "correct", "title": "NB 0", "prompt": "Q?"}]
        manifest = {"notebooks": notebooks, "title": "Test Module",
                    "intro_file": None, "module_dir": None}

        mock_cs = MagicMock()
        mock_cs.get_module_manifest.return_value = manifest

        mock_settings = MagicMock()
        mock_settings.demo_mode = True

        payload = UnlockSubmission(response=response or "", self_attest=self_attest)

        from app.routers.modules import complete_notebook
        with patch("app.routers.modules.cs", mock_cs), \
             patch("app.routers.modules.settings", mock_settings), \
             patch("app.progress_utils.settings", mock_settings):
            result = complete_notebook("mod", "nb_0.ipynb", payload, db=db, user=user)

        assert result.success is True
    finally:
        db.close()
