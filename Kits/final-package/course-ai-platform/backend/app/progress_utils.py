from sqlalchemy.orm import Session

from . import models
from .config import settings


def progress_map(db: Session, user_id: str, slug: str) -> dict:
    rows = (
        db.query(models.Progress)
        .filter(models.Progress.user_id == user_id, models.Progress.module_slug == slug)
        .all()
    )
    return {r.notebook_file: r for r in rows}


def ensure_progress_rows(db: Session, user_id: str, slug: str, notebooks: list) -> dict:
    """Make sure every notebook in this module has a Progress row for this user.
    The first notebook in the sequence starts unlocked; the rest start locked."""
    existing = progress_map(db, user_id, slug)
    # Mode-toggle cleanup: if demo mode is now off but rows were demo-initialised
    if not settings.demo_mode and existing:
        if any(r.demo_initialised for r in existing.values()):
            return reset_progress_to_normal(db, user_id, slug, notebooks)
    changed = False
    for i, nb in enumerate(notebooks):
        if nb["filename"] not in existing:
            db.add(models.Progress(
                user_id=user_id,
                module_slug=slug,
                notebook_file=nb["filename"],
                unlocked=(i == 0),
            ))
            changed = True
    if changed:
        db.commit()
        existing = progress_map(db, user_id, slug)
    return existing


def reset_progress_to_normal(db: Session, user_id: str, slug: str, notebooks: list) -> dict:
    """
    Reset all demo-initialised Progress rows back to normal initial state:
      first notebook: unlocked=True, completed=False
      remaining notebooks: unlocked=False, completed=False
      demo_initialised=False on all rows.
    Only resets rows where demo_initialised=True; leaves genuinely-earned
    rows (demo_initialised=False) untouched.
    """
    existing = progress_map(db, user_id, slug)
    for i, nb in enumerate(notebooks):
        filename = nb["filename"]
        if filename in existing and existing[filename].demo_initialised:
            row = existing[filename]
            row.unlocked = (i == 0)
            row.completed = False
            row.demo_initialised = False
    db.commit()
    return progress_map(db, user_id, slug)


def ensure_demo_progress_rows(db: Session, user_id: str, slug: str, notebooks: list) -> dict:
    """
    Upsert all notebook Progress rows for this user+module to:
      unlocked=True, completed=True, demo_initialised=True.
    Called on every module access while settings.demo_mode is True.
    Idempotent — safe to call multiple times.
    """
    existing = progress_map(db, user_id, slug)
    for nb in notebooks:
        filename = nb["filename"]
        if filename in existing:
            row = existing[filename]
            row.unlocked = True
            row.completed = True
            row.demo_initialised = True
        else:
            row = models.Progress(
                user_id=user_id,
                module_slug=slug,
                notebook_file=filename,
                unlocked=True,
                completed=True,
                demo_initialised=True,
            )
            db.add(row)
    db.commit()
    return progress_map(db, user_id, slug)


def module_completion(db: Session, user_id: str, slug: str, notebooks: list):
    progress = ensure_progress_rows(db, user_id, slug, notebooks)
    total = len(notebooks)
    completed = sum(1 for nb in notebooks if progress[nb["filename"]].completed)
    pct = round((completed / total) * 100, 1) if total else 0.0
    return progress, total, completed, pct
