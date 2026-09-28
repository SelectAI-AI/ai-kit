import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="student")  # student | instructor
    created_at = Column(DateTime, default=datetime.utcnow)

    progress = relationship("Progress", back_populates="user", cascade="all, delete-orphan")
    certificates = relationship("CertificateRecord", back_populates="user", cascade="all, delete-orphan")


class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    module_slug = Column(String, nullable=False)
    notebook_file = Column(String, nullable=False)
    unlocked = Column(Boolean, default=False)   # can the student currently access this notebook
    completed = Column(Boolean, default=False)  # has an instructor approved this notebook's submission
    attempts = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)
    demo_initialised = Column(Boolean, default=False)

    # not_submitted | pending | approved | rejected — approval gate on the student's submitted output
    status = Column(String, default="not_submitted")
    submission_text = Column(String, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    review_note = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)

    user = relationship("User", back_populates="progress")


class CertificateRecord(Base):
    __tablename__ = "certificates"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # pending | issued | revoked
    issued_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String, nullable=True)
    identity_confirmed = Column(Boolean, default=False)
    approved_by = Column(String, nullable=True)

    user = relationship("User", back_populates="certificates")
