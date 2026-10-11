import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, UniqueConstraint
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
    discount_tier = Column(String, default="none")  # none | student_t1 | student_t2 | corporate | college
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


class DiscountRequest(Base):
    __tablename__ = "discount_requests"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    details = Column(String, nullable=True)          # submitted student details
    status = Column(String, default="pending")       # pending | approved | rejected
    granted_tier = Column(String, nullable=True)     # student_t1 | student_t2 when approved
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)   # null for org bulk
    selection = Column(String, nullable=False)        # kit id | "bundle"
    kind = Column(String, default="individual")       # individual | college | corporate
    amount_paise = Column(Integer, nullable=False)    # server-authoritative
    currency = Column(String, default="INR")
    discount_tier = Column(String, default="none")
    razorpay_order_id = Column(String, unique=True, nullable=True)  # null for admin bulk
    razorpay_payment_id = Column(String, nullable=True)             # secondary confirmation
    status = Column(String, default="created")        # created | paid | failed
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)


class Entitlement(Base):
    __tablename__ = "entitlements"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    selection = Column(String, nullable=False)        # kit id | "bundle"
    slugs_csv = Column(String, nullable=False)        # snapshot of covered slugs at grant time
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "order_id", name="uq_entitlement_user_order"),
    )
