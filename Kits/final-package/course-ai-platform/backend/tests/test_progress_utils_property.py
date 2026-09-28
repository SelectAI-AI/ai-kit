"""
Property test for ensure_demo_progress_rows — Property 2.
Validates Requirements 2.1, 2.2
"""
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Progress
from app.progress_utils import ensure_demo_progress_rows


@given(notebook_count=st.integers(min_value=1, max_value=20))
@hyp_settings(max_examples=50)
def test_demo_progress_rows_always_fully_complete(notebook_count):
    """
    Property 2: For any module with 1..20 notebooks, after ensure_demo_progress_rows,
    every Progress row has unlocked=True, completed=True, demo_initialised=True.

    **Validates: Requirements 2.1, 2.2**
    """
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        notebooks = [{"filename": f"nb_{i}.ipynb"} for i in range(notebook_count)]
        ensure_demo_progress_rows(db, "user-1", "test-module", notebooks)
        rows = db.query(Progress).all()
        assert len(rows) == notebook_count
        for row in rows:
            assert row.unlocked is True
            assert row.completed is True
            assert row.demo_initialised is True
    finally:
        db.close()
