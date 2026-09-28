import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from .. import content_scanner as cs
from ..certificate import CERT_DIR, generate_certificate_pdf
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..progress_utils import ensure_progress_rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

COURSE_TITLE = "Applied AI Engineering Program"


def _all_modules_complete(db: Session, user_id: str) -> bool:
    slugs = cs.list_module_slugs()
    if not slugs:
        return False
    for slug in slugs:
        manifest = cs.get_module_manifest(slug)
        if not manifest or not manifest["notebooks"]:
            continue
        progress = ensure_progress_rows(db, user_id, slug, manifest["notebooks"])
        if not all(progress[nb["filename"]].completed for nb in manifest["notebooks"]):
            return False
    return True


@router.post("/request", response_model=schemas.CertificateOut)
def request_certificate(payload: schemas.CertificateRequestIn, db: Session = Depends(get_db),
                         user: models.User = Depends(get_current_user)):
    if not payload.confirm_identity:
        raise HTTPException(status_code=400, detail="Identity confirmation is required")

    # Skip _all_modules_complete check in demo mode
    if not settings.demo_mode:
        if not _all_modules_complete(db, user.id):
            raise HTTPException(status_code=400, detail="Complete all modules before requesting a certificate")

    existing = db.query(models.CertificateRecord).filter(
        models.CertificateRecord.user_id == user.id, models.CertificateRecord.status != "revoked"
    ).first()
    if existing:
        return existing

    if settings.demo_mode:
        cert = models.CertificateRecord(
            user_id=user.id,
            identity_confirmed=True,
            status="issued",
            issued_at=datetime.utcnow(),
        )
        db.add(cert)
        db.commit()
        db.refresh(cert)
        try:
            generate_certificate_pdf(cert.id, user.full_name, COURSE_TITLE, cert.issued_at)
        except Exception as e:
            db.delete(cert)
            db.commit()
            logger.error("DEMO_MODE certificate PDF generation failed: %s", e)
            raise HTTPException(status_code=500, detail="Certificate generation failed")
        logger.info("DEMO_MODE certificate issued: %s", cert.id)
        return cert

    # Normal flow
    cert = models.CertificateRecord(
        user_id=user.id,
        identity_confirmed=True,
        status="pending" if settings.require_instructor_approval else "issued",
    )
    if not settings.require_instructor_approval:
        cert.issued_at = datetime.utcnow()
        generate_certificate_pdf(cert.id, user.full_name, COURSE_TITLE, cert.issued_at)

    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


@router.get("/me", response_model=list[schemas.CertificateOut])
def my_certificates(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.CertificateRecord).filter(models.CertificateRecord.user_id == user.id).all()


@router.get("/{cert_id}/pdf")
def download_certificate(cert_id: str, db: Session = Depends(get_db),
                          user: models.User = Depends(get_current_user)):
    cert = db.query(models.CertificateRecord).filter(models.CertificateRecord.id == cert_id).first()
    if not cert or (cert.user_id != user.id and user.role != "instructor"):
        raise HTTPException(status_code=404, detail="Not found")
    if cert.status != "issued":
        raise HTTPException(status_code=400, detail="Certificate is not issued yet")
    path = CERT_DIR / f"{cert_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Certificate file missing")
    return FileResponse(path, filename=f"certificate-{cert_id}.pdf", media_type="application/pdf")


@router.get("/verify/{cert_id}")
def verify_certificate(cert_id: str, db: Session = Depends(get_db)):
    """Public — no auth. This is what the certificate's QR code links to."""
    cert = db.query(models.CertificateRecord).filter(models.CertificateRecord.id == cert_id).first()
    if not cert:
        return {"valid": False, "status": "not_found"}
    user = db.query(models.User).filter(models.User.id == cert.user_id).first()
    return {
        "valid": cert.status == "issued",
        "status": cert.status,
        "recipient": user.full_name if user else None,
        "course": COURSE_TITLE,
        "issued_at": cert.issued_at,
        "revoked_reason": cert.revoked_reason,
    }
