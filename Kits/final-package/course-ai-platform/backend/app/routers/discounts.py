from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_instructor

router = APIRouter(prefix="/api/discounts", tags=["discounts"])

# Discount tiers an Admin may grant when approving a student request (Req 3.3).
ALLOWED_APPROVAL_TIERS = {"student_t1", "student_t2"}


# --- Student endpoints (Req 2) ---

@router.post("/requests", response_model=schemas.DiscountRequestOut)
def submit_discount_request(payload: schemas.DiscountRequestIn, db: Session = Depends(get_db),
                            user: models.User = Depends(get_current_user)):
    """Submit a discount eligibility request. Rejects a second submission while an
    existing request for this user is still `pending` (Req 2.1, 2.2, 2.3)."""
    existing = (
        db.query(models.DiscountRequest)
        .filter(models.DiscountRequest.user_id == user.id,
                models.DiscountRequest.status == "pending")
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A pending discount request already exists (id: {existing.id})",
        )

    req = models.DiscountRequest(
        user_id=user.id,
        details=payload.details,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/requests/me", response_model=schemas.DiscountRequestOut)
def my_discount_request(db: Session = Depends(get_db),
                        user: models.User = Depends(get_current_user)):
    """Return the student's most recent discount request status and, when approved,
    the granted tier (Req 2.4)."""
    req = (
        db.query(models.DiscountRequest)
        .filter(models.DiscountRequest.user_id == user.id)
        .order_by(models.DiscountRequest.created_at.desc())
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="No discount request found")
    return req


# --- Admin endpoints (Req 3) — all guarded by require_instructor (Req 3.5) ---

@router.get("/requests", response_model=List[schemas.DiscountRequestOut])
def list_discount_requests(db: Session = Depends(get_db),
                           admin: models.User = Depends(require_instructor)):
    """List all discount requests with their statuses and submitting user ids (Req 3.1)."""
    return (
        db.query(models.DiscountRequest)
        .order_by(models.DiscountRequest.created_at.desc())
        .all()
    )


@router.post("/requests/{request_id}/approve", response_model=schemas.DiscountRequestOut)
def approve_discount_request(request_id: str, tier: str, db: Session = Depends(get_db),
                             admin: models.User = Depends(require_instructor)):
    """Approve a discount request at the specified tier. Only `student_t1` or
    `student_t2` are accepted; any other tier is rejected with the request and the
    student's tier left unchanged (Req 3.2, 3.3)."""
    if tier not in ALLOWED_APPROVAL_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid discount tier '{tier}'; must be one of student_t1, student_t2",
        )

    req = (
        db.query(models.DiscountRequest)
        .filter(models.DiscountRequest.id == request_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Discount request not found")

    student = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Submitting user not found")

    req.status = "approved"
    req.granted_tier = tier
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.utcnow()
    student.discount_tier = tier

    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/reject", response_model=schemas.DiscountRequestOut)
def reject_discount_request(request_id: str, db: Session = Depends(get_db),
                            admin: models.User = Depends(require_instructor)):
    """Reject a discount request. The submitting student's discount tier is left as
    `none` (Req 3.4)."""
    req = (
        db.query(models.DiscountRequest)
        .filter(models.DiscountRequest.id == request_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Discount request not found")

    req.status = "rejected"
    req.granted_tier = None
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(req)
    return req
