from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from .. import content_scanner as cs
from ..certificate import generate_certificate_pdf
from ..database import get_db
from ..deps import require_instructor
from ..progress_utils import ensure_progress_rows

router = APIRouter(prefix="/api/instructor", tags=["instructor"])
COURSE_TITLE = "Applied AI Engineering Program"


def _overall_percent(db: Session, user_id: str) -> float:
    pcts = []
    for slug in cs.list_module_slugs():
        manifest = cs.get_module_manifest(slug)
        if not manifest or not manifest["notebooks"]:
            continue
        progress = ensure_progress_rows(db, user_id, slug, manifest["notebooks"])
        completed = sum(1 for nb in manifest["notebooks"] if progress[nb["filename"]].completed)
        pcts.append(round((completed / len(manifest["notebooks"])) * 100, 1))
    return round(sum(pcts) / len(pcts), 1) if pcts else 0.0


@router.get("/students", response_model=list[schemas.StudentSummary])
def list_students(db: Session = Depends(get_db), instructor: models.User = Depends(require_instructor)):
    students = db.query(models.User).filter(models.User.role == "student").all()
    out = []
    for s in students:
        pending = db.query(models.CertificateRecord).filter(
            models.CertificateRecord.user_id == s.id, models.CertificateRecord.status == "pending"
        ).first()
        out.append(schemas.StudentSummary(
            id=s.id, email=s.email, full_name=s.full_name,
            overall_percent=_overall_percent(db, s.id),
            pending_certificate=pending.id if pending else None,
        ))
    return out


@router.get("/certificates/pending")
def pending_certificates(db: Session = Depends(get_db), instructor: models.User = Depends(require_instructor)):
    certs = db.query(models.CertificateRecord).filter(models.CertificateRecord.status == "pending").all()
    result = []
    for cert in certs:
        user = db.query(models.User).filter(models.User.id == cert.user_id).first()
        result.append({
            "id": cert.id,
            "user_email": user.email if user else None,
            "user_name": user.full_name if user else None,
        })
    return result


@router.post("/certificates/{cert_id}/approve", response_model=schemas.CertificateOut)
def approve_certificate(cert_id: str, db: Session = Depends(get_db),
                         instructor: models.User = Depends(require_instructor)):
    cert = db.query(models.CertificateRecord).filter(models.CertificateRecord.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    user = db.query(models.User).filter(models.User.id == cert.user_id).first()

    cert.status = "issued"
    cert.issued_at = datetime.utcnow()
    cert.approved_by = instructor.id
    generate_certificate_pdf(cert.id, user.full_name, COURSE_TITLE, cert.issued_at)
    db.commit()
    db.refresh(cert)
    return cert


@router.post("/certificates/{cert_id}/revoke", response_model=schemas.CertificateOut)
def revoke_certificate(cert_id: str, reason: str = "", db: Session = Depends(get_db),
                        instructor: models.User = Depends(require_instructor)):
    cert = db.query(models.CertificateRecord).filter(models.CertificateRecord.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    cert.status = "revoked"
    cert.revoked_at = datetime.utcnow()
    cert.revoked_reason = reason or "Revoked by instructor"
    db.commit()
    db.refresh(cert)
    return cert


@router.get("/submissions/pending", response_model=list[schemas.PendingSubmissionOut])
def pending_submissions(db: Session = Depends(get_db), instructor: models.User = Depends(require_instructor)):
    rows = (
        db.query(models.Progress)
        .filter(models.Progress.status == "pending")
        .order_by(models.Progress.submitted_at)
        .all()
    )
    out = []
    for row in rows:
        user = db.query(models.User).filter(models.User.id == row.user_id).first()
        manifest = cs.get_module_manifest(row.module_slug)
        notebook_title, qtype = row.notebook_file, None
        module_title = row.module_slug
        if manifest:
            module_title = manifest["title"]
            nb = next((n for n in manifest["notebooks"] if n["filename"] == row.notebook_file), None)
            if nb:
                notebook_title, qtype = nb["title"], nb["question_type"]
        out.append(schemas.PendingSubmissionOut(
            progress_id=row.id, user_id=row.user_id,
            user_name=user.full_name if user else "?", user_email=user.email if user else "?",
            module_slug=row.module_slug, module_title=module_title,
            notebook_file=row.notebook_file, notebook_title=notebook_title,
            question_type=qtype, submission_text=row.submission_text or "",
            submitted_at=row.submitted_at,
        ))
    return out


@router.post("/submissions/{progress_id}/approve", response_model=schemas.NotebookReviewResult)
def approve_submission(progress_id: int, db: Session = Depends(get_db),
                        instructor: models.User = Depends(require_instructor)):
    row = db.query(models.Progress).filter(models.Progress.id == progress_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="This submission is not pending review")

    row.status = "approved"
    row.completed = True
    row.completed_at = datetime.utcnow()
    row.reviewed_by = instructor.id
    row.review_note = None

    next_file = None
    manifest = cs.get_module_manifest(row.module_slug)
    if manifest:
        notebooks = manifest["notebooks"]
        idx = next((i for i, nb in enumerate(notebooks) if nb["filename"] == row.notebook_file), None)
        if idx is not None and idx + 1 < len(notebooks):
            next_filename = notebooks[idx + 1]["filename"]
            next_row = (
                db.query(models.Progress)
                .filter(models.Progress.user_id == row.user_id, models.Progress.module_slug == row.module_slug,
                        models.Progress.notebook_file == next_filename)
                .first()
            )
            if next_row and not next_row.unlocked:
                next_row.unlocked = True
                next_file = next_filename

    db.commit()
    return schemas.NotebookReviewResult(progress_id=row.id, status=row.status, next_unlocked=next_file)


@router.post("/submissions/{progress_id}/reject", response_model=schemas.NotebookReviewResult)
def reject_submission(progress_id: int, payload: schemas.ReviewIn, db: Session = Depends(get_db),
                       instructor: models.User = Depends(require_instructor)):
    row = db.query(models.Progress).filter(models.Progress.id == progress_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="This submission is not pending review")

    row.status = "rejected"
    row.review_note = payload.note or "Rejected by instructor — please revise and resubmit."
    row.reviewed_by = instructor.id
    db.commit()
    return schemas.NotebookReviewResult(progress_id=row.id, status=row.status, next_unlocked=None)
