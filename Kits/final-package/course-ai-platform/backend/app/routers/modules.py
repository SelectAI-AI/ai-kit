import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from .. import content_scanner as cs
from ..access_service import can_access_slug
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..progress_utils import ensure_progress_rows, ensure_demo_progress_rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/modules", tags=["modules"])


def _default_prompt(qtype: str):
    if qtype == "reflection":
        return "In a few sentences, describe what you implemented or learned in this notebook."
    if qtype == "self_attest":
        return "Confirm that you have completed this notebook."
    return None


def _assert_slug_access(db: Session, user: models.User, slug: str):
    """Deny gated module/notebook access without an entitlement/exemption (Req 9.1, 9.2).

    Instructors, DEMO_MODE, and free slugs are exempt via the Access_Service; an
    active entitlement covering the slug also grants access. Otherwise a ``403``
    is raised carrying the ``required_kit_id`` the buyer needs to unlock the slug.
    """
    decision = can_access_slug(db, user, slug)
    if not decision.allowed:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "This module is locked. Purchase the required kit to unlock it.",
                "required_kit_id": decision.required_kit_id,
            },
        )


@router.get("", response_model=list[schemas.ModuleSummary])
def list_modules(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    summaries = []
    for slug in cs.list_module_slugs():
        manifest = cs.get_module_manifest(slug)
        if not manifest or not manifest["notebooks"]:
            continue
        if settings.demo_mode:
            progress = ensure_demo_progress_rows(db, user.id, slug, manifest["notebooks"])
            total = len(manifest["notebooks"])
            completed = total
            pct = 100.0
        else:
            progress = ensure_progress_rows(db, user.id, slug, manifest["notebooks"])
            total = len(manifest["notebooks"])
            completed = sum(1 for nb in manifest["notebooks"] if progress[nb["filename"]].completed)
            pct = round((completed / total) * 100, 1) if total else 0.0
        summaries.append(schemas.ModuleSummary(
            slug=slug, title=manifest["title"], total_notebooks=total,
            completed_notebooks=completed, percent_complete=pct,
        ))
    return summaries


@router.get("/{slug}", response_model=schemas.ModuleDetail)
def module_detail(slug: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    manifest = cs.get_module_manifest(slug)
    if not manifest:
        raise HTTPException(status_code=404, detail="Module not found")

    # Gate paid module detail behind an active entitlement/exemption (Req 9.1, 9.2).
    _assert_slug_access(db, user, slug)

    if settings.demo_mode:
        progress = ensure_demo_progress_rows(db, user.id, slug, manifest["notebooks"])
    else:
        progress = ensure_progress_rows(db, user.id, slug, manifest["notebooks"])

    notebooks_out = []
    for i, nb in enumerate(manifest["notebooks"]):
        row = progress[nb["filename"]]
        unlocked = True if settings.demo_mode else row.unlocked
        completed = True if settings.demo_mode else row.completed
        notebooks_out.append(schemas.NotebookOut(
            filename=nb["filename"], title=nb["title"], description=nb.get("description"),
            order=i, unlocked=unlocked, completed=completed,
            question_type=nb["question_type"],
            prompt=nb.get("prompt") or _default_prompt(nb["question_type"]),
            status="approved" if settings.demo_mode else (row.status or "not_submitted"),
            submission_text=None if settings.demo_mode else row.submission_text,
            review_note=None if settings.demo_mode else row.review_note,
        ))

    total = len(notebooks_out)
    completed_count = sum(1 for nb in notebooks_out if nb.completed)
    pct = 100.0 if settings.demo_mode else (round((completed_count / total) * 100, 1) if total else 0.0)
    return schemas.ModuleDetail(
        slug=slug, title=manifest["title"], intro_markdown=cs.read_intro_markdown(manifest),
        notebooks=notebooks_out, percent_complete=pct,
    )


@router.post("/{slug}/notebook/{filename}/complete", response_model=schemas.UnlockResult)
def complete_notebook(slug: str, filename: str, payload: schemas.UnlockSubmission,
                       db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    manifest = cs.get_module_manifest(slug)
    if not manifest:
        raise HTTPException(status_code=404, detail="Module not found")

    notebooks = manifest["notebooks"]
    idx = next((i for i, nb in enumerate(notebooks) if nb["filename"] == filename), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Notebook not found")

    progress = ensure_progress_rows(db, user.id, slug, notebooks)
    row = progress[filename]
    if not row.unlocked:
        raise HTTPException(status_code=403, detail="This notebook is still locked")
    if row.completed:
        return schemas.UnlockResult(success=True, message="Already completed.", next_unlocked=None)

    if settings.demo_mode:
        row.completed = True
        row.completed_at = datetime.utcnow()
        next_file = None
        if idx + 1 < len(notebooks):
            next_row = progress[notebooks[idx + 1]["filename"]]
            if not next_row.unlocked:
                next_row.unlocked = True
                next_file = notebooks[idx + 1]["filename"]
        db.commit()
        logger.info("DEMO_MODE notebook complete: %s", filename)
        return schemas.UnlockResult(success=True, message="Demo complete.", next_unlocked=next_file)

    if row.status == "pending":
        return schemas.UnlockResult(success=True, message="Already submitted — waiting for instructor approval.", next_unlocked=None)

    nb_config = notebooks[idx]
    qtype = nb_config["question_type"]
    row.attempts = (row.attempts or 0) + 1

    # Quiz questions are graded against a stored answer. A correct answer
    # completes the notebook and unlocks the next one immediately (no
    # instructor review); a wrong or empty answer returns success=False.
    if qtype == "quiz":
        expected = (nb_config.get("answer") or "").strip().lower()
        given = (payload.response or "").strip().lower()
        if not expected or given != expected:
            db.commit()
            return schemas.UnlockResult(
                success=False,
                message="That's not the right answer — try again.",
                next_unlocked=None,
            )
        row.submission_text = payload.response
        row.completed = True
        row.completed_at = datetime.utcnow()
        row.status = "approved"
        row.review_note = None
        next_file = None
        if idx + 1 < len(notebooks):
            next_row = progress[notebooks[idx + 1]["filename"]]
            if not next_row.unlocked:
                next_row.unlocked = True
                next_file = notebooks[idx + 1]["filename"]
        db.commit()
        return schemas.UnlockResult(success=True, message="Correct — unlocked.", next_unlocked=next_file)

    if qtype == "self_attest":
        submitted = payload.self_attest is True
        content = "Confirmed by student."
        empty_message = "Please confirm the checkbox."
    else:
        submitted = len((payload.response or "").strip()) > 0
        content = payload.response
        empty_message = "Please write a response before submitting."

    if not submitted:
        db.commit()
        return schemas.UnlockResult(success=False, message=empty_message, next_unlocked=None)

    row.submission_text = content
    row.status = "pending"
    row.submitted_at = datetime.utcnow()
    row.review_note = None
    db.commit()
    return schemas.UnlockResult(success=True, message="Submitted — waiting for instructor approval.", next_unlocked=None)


def _assert_unlocked(db, user, slug, filename):
    if settings.demo_mode:
        return
    manifest = cs.get_module_manifest(slug)
    if not manifest:
        raise HTTPException(status_code=404, detail="Module not found")
    progress = ensure_progress_rows(db, user.id, slug, manifest["notebooks"])
    row = progress.get(filename)
    if not row or not row.unlocked:
        raise HTTPException(status_code=403, detail="Locked")


@router.get("/{slug}/notebook/{filename}/view", response_class=HTMLResponse)
def view_notebook(slug: str, filename: str, db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    # Gate paid notebook content behind an active entitlement/exemption (Req 9.1, 9.2).
    _assert_slug_access(db, user, slug)
    _assert_unlocked(db, user, slug, filename)
    path = cs.notebook_path(slug, filename)
    if not path:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return cs.render_notebook_html(path)
