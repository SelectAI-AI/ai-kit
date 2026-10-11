"""Access_Service — kit-gated module access decisions (Req 9).

Extends the existing per-notebook module gating with entitlement-driven access
control. A user may access a module slug when any exemption holds — the user is
an instructor (Req 9.3), ``DEMO_MODE`` is enabled (Req 9.4), or the slug is
designated free (Req 9.5) — or when the user holds an active entitlement whose
snapshot of covered slugs includes that slug (Req 9.1). Otherwise access is
denied and the decision reports the first kit that would unlock the slug so the
caller can direct the buyer to the right purchase (Req 9.2).
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from .config import settings
from .models import Entitlement
from .pricing_catalog import FREE_SLUGS, KIT_CATALOG


@dataclass(frozen=True)
class AccessDecision:
    """Outcome of an access check for a single module slug (Req 9.1, 9.2).

    ``allowed`` is ``True`` when access is granted. When access is denied,
    ``required_kit_id`` names the first kit in the catalog whose slugs cover the
    requested slug (``None`` when no kit covers it, e.g. the capstone).
    """

    allowed: bool
    required_kit_id: str | None = None


def _required_kit_id(slug: str) -> str | None:
    """First kit in catalog order whose slugs include ``slug`` (Req 9.2)."""
    for kit_id, entry in KIT_CATALOG.items():
        if slug in (entry.get("slugs") or []):
            return kit_id
    return None


def _has_active_entitlement(db: Session, user_id: str, slug: str) -> bool:
    """True if the user holds an active entitlement whose snapshot covers ``slug`` (Req 9.1)."""
    rows = (
        db.query(Entitlement.slugs_csv)
        .filter(Entitlement.user_id == user_id, Entitlement.active.is_(True))
        .all()
    )
    for (slugs_csv,) in rows:
        covered = {s for s in (slugs_csv or "").split(",") if s}
        if slug in covered:
            return True
    return False


def can_access_slug(db: Session, user, slug: str) -> AccessDecision:
    """Decide whether ``user`` may access the gated module ``slug`` (Req 9).

    Allow iff any exemption holds or an active entitlement covers the slug:
      * instructor role (Req 9.3)
      * ``DEMO_MODE`` enabled (Req 9.4)
      * slug designated free (Req 9.5)
      * an active entitlement covering the slug (Req 9.1)
    Otherwise deny with the kit required to unlock the slug (Req 9.2).
    """
    # Exemptions — granted without an entitlement.
    if getattr(user, "role", None) == "instructor":  # Req 9.3
        return AccessDecision(allowed=True)
    if settings.demo_mode:  # Req 9.4
        return AccessDecision(allowed=True)
    if slug in FREE_SLUGS:  # Req 9.5
        return AccessDecision(allowed=True)

    # Entitlement-based access (Req 9.1).
    user_id = getattr(user, "id", None)
    if user_id is not None and _has_active_entitlement(db, user_id, slug):
        return AccessDecision(allowed=True)

    # Denied — report the kit that would unlock the slug (Req 9.2).
    return AccessDecision(allowed=False, required_kit_id=_required_kit_id(slug))
