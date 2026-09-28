"""
Property test for demo certificate issuance — Property 4.
Validates Requirements 4.1, 4.2
"""
from hypothesis import given, settings as hyp_settings, strategies as st
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock

from app.database import Base
from app.models import User
from app.schemas import CertificateRequestIn


@given(require_approval=st.booleans())
@hyp_settings(max_examples=30, deadline=None)
def test_demo_certificate_always_issued(require_approval):
    """
    Property 4: In demo mode, request_certificate always returns status="issued"
    regardless of require_instructor_approval.

    **Validates: Requirements 4.1, 4.2**
    """
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        user = User(id="u1", email="u@test.com", full_name="Test User", hashed_password="x")
        db.add(user)
        db.commit()

        mock_settings = MagicMock()
        mock_settings.demo_mode = True
        mock_settings.require_instructor_approval = require_approval

        payload = CertificateRequestIn(confirm_identity=True, legal_name="Test User")

        from app.routers.certificates import request_certificate
        with patch("app.routers.certificates.settings", mock_settings), \
             patch("app.routers.certificates.generate_certificate_pdf") as mock_pdf:
            mock_pdf.return_value = None
            result = request_certificate(payload, db=db, user=user)

        assert result.status == "issued"
        assert result.issued_at is not None
    finally:
        db.close()
