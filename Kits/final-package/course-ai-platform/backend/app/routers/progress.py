from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from .. import content_scanner as cs
from ..database import get_db
from ..deps import get_current_user
from ..progress_utils import ensure_progress_rows

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/me", response_model=schemas.ProgressOverview)
def my_progress(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    summaries = []
    for slug in cs.list_module_slugs():
        manifest = cs.get_module_manifest(slug)
        if not manifest or not manifest["notebooks"]:
            continue
        progress = ensure_progress_rows(db, user.id, slug, manifest["notebooks"])
        total = len(manifest["notebooks"])
        completed = sum(1 for nb in manifest["notebooks"] if progress[nb["filename"]].completed)
        pct = round((completed / total) * 100, 1) if total else 0.0
        summaries.append(schemas.ModuleSummary(
            slug=slug, title=manifest["title"], total_notebooks=total,
            completed_notebooks=completed, percent_complete=pct,
        ))

    overall = round(sum(s.percent_complete for s in summaries) / len(summaries), 1) if summaries else 0.0
    eligible = len(summaries) > 0 and all(s.percent_complete == 100.0 for s in summaries)
    return schemas.ProgressOverview(modules=summaries, overall_percent=overall, eligible_for_certificate=eligible)
